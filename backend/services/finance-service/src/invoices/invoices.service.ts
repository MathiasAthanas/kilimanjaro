import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialAuditAction, InvoiceStatus, PaymentStatus, Prisma } from '../../generated/prisma';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { AccessControlService } from '../common/helpers/access-control.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { schoolScopeFilter, assertSchoolInScope, schoolInScope } from '../common/helpers/school-scope.helper';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { InvoicePdfService } from './invoice-pdf.service';

type InvoiceGenerationJob = {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  result?: {
    generated: number;
    skipped: number;
    failed: number;
    invoiceIds: string[];
  };
  error?: string;
};

@Injectable()
export class InvoicesService {
  private static readonly generationJobs = new Map<string, InvoiceGenerationJob>();
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly studentClient: StudentClientService,
    private readonly redis: RedisService,
    private readonly numberService: NumberSequenceService,
    private readonly audit: AuditService,
    private readonly rabbitMq: RabbitMqService,
    private readonly pdf: InvoicePdfService,
    private readonly accessControl: AccessControlService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }
    return payload as T;
  }

  private decimal(value: string | number): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private status(total: Prisma.Decimal, paid: Prisma.Decimal, dueDate: Date): InvoiceStatus {
    const outstanding = total.minus(paid);
    if (outstanding.lte(0)) return InvoiceStatus.PAID;
    if (paid.gt(0) && outstanding.gt(0)) return dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.PARTIALLY_PAID;
    return dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.ISSUED;
  }

  private async generateInvoiceForStudent(student: any, dto: GenerateInvoicesDto, actor: RequestUser) {
    const classId = student.enrolments?.[0]?.classId;
    if (!classId) return null;
    // Invoices are stamped with the student's own school. Students outside the caller's schools are skipped.
    const studentSchoolId: string | null = student.schoolId ?? student.enrolments?.[0]?.class?.schoolId ?? null;
    if (!schoolInScope(actor, studentSchoolId)) return null;
    const studentClass = student.enrolments?.[0]?.class;
    const educationStage = studentClass?.educationStage ?? undefined;
    const classLevel = studentClass?.level ?? undefined;

    const existing = await this.prisma.invoice.findUnique({
      where: {
        studentId_termId_academicYearId: {
          studentId: student.id,
          termId: dto.termId,
          academicYearId: dto.academicYearId,
        },
      },
    });
    if (existing) return null;

    const [groupMemberships, assignments] = await Promise.all([
      this.prisma.studentGroupMembership.findMany({
        where: { studentId: student.id, isActive: true, group: { isActive: true } },
        include: { group: true },
      }),
      this.prisma.studentFeeAssignment.findMany({
        where: {
          studentId: student.id,
          academicYearId: dto.academicYearId,
          isActive: true,
          OR: [{ termId: dto.termId }, { termId: null }],
        },
      }),
    ]);
    const studentGroupCodes = groupMemberships.map((item) => item.group.code);

    const schoolId = studentSchoolId;

    const structures = await this.prisma.feeStructure.findMany({
      where: {
        academicYearId: dto.academicYearId,
        isActive: true,
        ...(schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {}),
        AND: [
          { OR: [{ termId: dto.termId }, { termId: null }] },
          {
            OR: [
              { classId },
              { educationStage, classLevel },
              { educationStage, classLevel: null },
              ...(studentGroupCodes.length ? [{ studentGroup: { in: studentGroupCodes } }] : []),
            ],
          },
        ],
      },
      include: { feeCategory: true },
    });

    // Score specificity so that when multiple structures match the same category we keep
    // the most targeted one (classId > stage+level > stage-only > studentGroup).
    const specificity = (s: (typeof structures)[number]) => {
      // A school's own price always beats a legacy group-wide one for the same category.
      const schoolBonus = schoolId && s.schoolId === schoolId ? 10 : 0;
      if (s.classId === classId) return 3 + schoolBonus;
      if (s.educationStage === educationStage && s.classLevel === classLevel) return 2 + schoolBonus;
      if (s.educationStage === educationStage && s.classLevel === null) return 1 + schoolBonus;
      return 0 + schoolBonus;
    };

    const optionalSet = new Set(assignments.map((a) => a.feeCategoryId));
    const deduped = new Map<string, (typeof structures)[number]>();
    for (const s of structures) {
      if (s.feeCategory.isOptional && !optionalSet.has(s.feeCategoryId)) continue;
      const existing = deduped.get(s.feeCategoryId);
      if (!existing || specificity(s) > specificity(existing)) {
        deduped.set(s.feeCategoryId, s);
      }
    }
    const applicable = [...deduped.values()];
    if (!applicable.length) return null;

    const subtotal = applicable.reduce((acc, item) => acc.plus(item.amount), new Prisma.Decimal(0));
    const total = subtotal;
    const grace = Number(this.configService.get<string>('FEE_DUE_GRACE_DAYS', '14'));
    const dueDate = new Date(Date.now() + grace * 24 * 60 * 60 * 1000);
    const invoiceNumber = await this.numberService.invoiceNumber(dto.termId.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), schoolId);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        schoolId,
        studentId: student.id,
        classId,
        educationStage,
        classLevel,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        subtotal,
        totalAmount: total,
        outstandingBalance: total,
        dueDate,
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
        issuedById: actor.id,
        lineItems: {
          create: applicable.map((item) => ({
            feeStructureId: item.id,
            feeCategoryId: item.feeCategoryId,
            feeCategoryName: item.feeCategory.name,
            amount: item.amount,
            currency: item.currency,
          })),
        },
      },
      include: { lineItems: true },
    });

    // PDF rendering is decoupled from invoice creation: a rendering hiccup must
    // not lose or miscount an otherwise-valid invoice (it can be regenerated).
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await this.pdf.generate({
        invoiceNumber: invoice.invoiceNumber,
        studentName: `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Student',
        registrationNumber: student.registrationNumber,
        className: student.enrolments?.[0]?.class?.name || classId,
        termId: dto.termId,
        academicYearId: dto.academicYearId,
        termName: (await this.studentClient.termLabels()).get(dto.termId)?.name ?? null,
        academicYearName: (await this.studentClient.termLabels()).get(dto.termId)?.academicYearName ?? null,
        school: await this.studentClient.schoolProfile(invoice.schoolId),
        status: invoice.status,
        lineItems: invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
        totalAmount: invoice.totalAmount.toString(),
        paidAmount: invoice.paidAmount.toString(),
        outstandingBalance: invoice.outstandingBalance.toString(),
        dueDate: invoice.dueDate,
      });
    } catch (err) {
      this.logger.error(
        `Invoice PDF generation failed for ${invoice.invoiceNumber} (${invoice.id}): ${(err as Error)?.stack ?? err}`,
      );
    }

    const withPdf = await this.prisma.invoice.update({ where: { id: invoice.id }, data: { pdfUrl } });

    await this.audit.log({
      entityType: 'Invoice',
      entityId: invoice.id,
      action: FinancialAuditAction.INVOICE_GENERATED,
      performedById: actor.id,
      performedByRole: actor.role,
      newValue: withPdf,
    });
    await this.audit.log({
      entityType: 'Invoice',
      entityId: invoice.id,
      action: FinancialAuditAction.INVOICE_ISSUED,
      performedById: actor.id,
      performedByRole: actor.role,
      newValue: withPdf,
    });

    await this.rabbitMq.publish('invoice.generated', {
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      totalAmount: invoice.totalAmount.toString(),
      dueDate: invoice.dueDate.toISOString(),
      termId: invoice.termId,
    });

    return withPdf;
  }

  private async runGenerationJob(jobId: string, dto: GenerateInvoicesDto, user: RequestUser): Promise<void> {
    InvoicesService.generationJobs.set(jobId, {
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    });

    try {
      const studentsPayload = dto.classIds?.length
        ? await Promise.all(
            dto.classIds.map((classId) =>
              this.studentClient.get<any>(
                '/students',
                { classId, page: 1, limit: 2000 },
                {
                  'X-User-Id': user.id,
                  'X-User-Role': user.role,
                },
              ),
            ),
          )
        : [
            await this.studentClient.get<any>(
              '/students',
              { page: 1, limit: 5000 },
              {
                'X-User-Id': user.id,
                'X-User-Role': user.role,
              },
            ),
          ];

      const students = studentsPayload.flatMap((payload) => this.unwrap<any>(payload)?.items || []);

      let generated = 0;
      let skipped = 0;
      let failed = 0;
      const invoiceIds: string[] = [];

      for (const student of students) {
        try {
          const invoice = await this.generateInvoiceForStudent(student, dto, user);
          if (invoice) {
            generated += 1;
            invoiceIds.push(invoice.id);
          } else {
            skipped += 1;
          }
        } catch (err) {
          failed += 1;
          this.logger.error(
            `Invoice generation failed for student ${student?.id}: ${(err as Error)?.stack ?? err}`,
          );
        }
      }

      InvoicesService.generationJobs.set(jobId, {
        status: 'COMPLETED',
        startedAt: InvoicesService.generationJobs.get(jobId)?.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: { generated, skipped, failed, invoiceIds },
      });
    } catch (error) {
      InvoicesService.generationJobs.set(jobId, {
        status: 'FAILED',
        startedAt: InvoicesService.generationJobs.get(jobId)?.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  }

  async generate(dto: GenerateInvoicesDto, user: RequestUser) {
    const jobId = `invgen-${Date.now()}`;
    InvoicesService.generationJobs.set(jobId, {
      status: 'PENDING',
      startedAt: new Date().toISOString(),
    });

    void this.runGenerationJob(jobId, dto, user);

    return {
      jobId,
      status: 'PENDING',
      message: 'Invoice generation started in background',
    };
  }

  getJob(jobId: string) {
    const job = InvoicesService.generationJobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Invoice generation job not found');
    }
    return { jobId, ...job };
  }

  async list(filters: any, user: RequestUser) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      if (filters.studentId) {
        throw new ForbiddenException('Director roles can only access aggregate finance data');
      }

      const aggregate = await this.prisma.invoice.aggregate({
        _sum: { totalAmount: true, paidAmount: true, outstandingBalance: true },
        where: {
          ...schoolScopeFilter(user),
          termId: filters.termId,
          academicYearId: filters.academicYearId,
          classId: filters.classId,
          status: filters.status,
        },
      });
      return { aggregateOnly: true, ...aggregate };
    }

    if (filters.paged && !['PARENT', 'STUDENT'].includes(user.role)) {
      return this.listPaged(filters, user, page, limit);
    }

    let studentFilter: string | undefined = filters.studentId;

    if (user.role === 'STUDENT') {
      const ownStudentId = await this.accessControl.resolveStudentIdForAuthUser(user.id);
      if (!ownStudentId) {
        throw new ForbiddenException('Student profile not found');
      }
      if (studentFilter && studentFilter !== ownStudentId) {
        throw new ForbiddenException('Student can only access own invoices');
      }
      studentFilter = ownStudentId;
    }

    if (user.role === 'PARENT') {
      const studentIds = await this.accessControl.resolveGuardianStudentIds(user.id);
      if (!studentIds.length) {
        return [];
      }

      if (studentFilter && !studentIds.includes(studentFilter)) {
        throw new ForbiddenException('Parent can only access own child invoices');
      }

      return this.describe(await this.prisma.invoice.findMany({
        where: {
          studentId: studentFilter || { in: studentIds },
          classId: filters.classId,
          termId: filters.termId,
          academicYearId: filters.academicYearId,
          status: filters.status,
          invoiceNumber: filters.search ? { contains: filters.search, mode: 'insensitive' as const } : undefined,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }));
    }

    const rows = await this.prisma.invoice.findMany({
      where: {
        ...schoolScopeFilter(user),
        studentId: studentFilter,
        classId: filters.classId,
        termId: filters.termId,
        academicYearId: filters.academicYearId,
        status: filters.status,
        invoiceNumber: filters.search ? { contains: filters.search, mode: 'insensitive' as const } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return this.describe(rows);
  }

  /**
   * The ledger the web finance desk works from: one page of invoices plus the totals, status counts and
   * filter choices for the WHOLE filtered set, so the numbers on screen never depend on which page is showing.
   */
  private async listPaged(filters: any, user: RequestUser, page: number, limit: number) {
    const base: Prisma.InvoiceWhereInput = {
      ...schoolScopeFilter(user),
      classId: filters.classId || undefined,
      termId: filters.termId || undefined,
      academicYearId: filters.academicYearId || undefined,
      studentId: filters.studentId || undefined,
    };
    const q = String(filters.search ?? filters.q ?? '').trim();
    if (q) {
      const ids = await this.studentClient.searchStudents(q);
      base.OR = [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, ...(ids.length ? [{ studentId: { in: ids } }] : [])];
    }
    const statuses = String(filters.status ?? '').split(',').map((v) => v.trim().toUpperCase()).filter(Boolean) as InvoiceStatus[];
    // Cancelled invoices were never owed, so they stay out of the money unless someone asks for them.
    const where: Prisma.InvoiceWhereInput = {
      ...base,
      status: statuses.length ? { in: statuses } : { not: InvoiceStatus.CANCELLED },
    };

    const [rows, total, sums, byStatus, classGroups, termGroups] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: filters.sort === 'outstanding' ? [{ outstandingBalance: 'desc' }, { invoiceNumber: 'desc' }] : [{ dueDate: 'desc' }, { invoiceNumber: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({ where, _sum: { totalAmount: true, paidAmount: true, outstandingBalance: true } }),
      this.prisma.invoice.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.prisma.invoice.groupBy({ by: ['classId'], where: { ...schoolScopeFilter(user), academicYearId: filters.academicYearId || undefined } }),
      this.prisma.invoice.groupBy({ by: ['termId'], where: { ...schoolScopeFilter(user), academicYearId: filters.academicYearId || undefined } }),
    ]);

    const items = await this.describe(rows);
    const labels = await this.studentClient.termLabels();
    // Class names come from any student of that class (invoices only store the class id).
    const sample = classGroups.length
      ? await this.prisma.invoice.findMany({ where: { classId: { in: classGroups.map((g) => g.classId) }, ...schoolScopeFilter(user) }, distinct: ['classId'], select: { classId: true, studentId: true, schoolId: true } })
      : [];
    const sampleNames = await this.studentClient.lookupStudents(sample.map((r) => r.studentId));
    const counts: Record<string, number> = {};
    let all = 0;
    for (const g of byStatus) {
      counts[g.status] = g._count._all;
      if (g.status !== InvoiceStatus.CANCELLED) all += g._count._all;
    }
    counts.ALL = all;

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      totals: {
        totalAmount: (sums._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        paidAmount: (sums._sum.paidAmount ?? new Prisma.Decimal(0)).toString(),
        outstanding: (sums._sum.outstandingBalance ?? new Prisma.Decimal(0)).toString(),
      },
      counts,
      facets: {
        classes: (
          await Promise.all(
            sample.map(async (r) => ({
              id: r.classId,
              name: sampleNames.get(r.studentId)?.className ?? r.classId,
              schoolName: await this.studentClient.schoolName(r.schoolId),
            })),
          )
        ).sort((a, b) => a.name.localeCompare(b.name) || String(a.schoolName).localeCompare(String(b.schoolName))),
        terms: termGroups
          .map((g) => ({ id: g.termId, name: labels.get(g.termId)?.name ?? g.termId, academicYearName: labels.get(g.termId)?.academicYearName ?? null }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    };
  }

  /** Adds student name/class and the readable term to invoice rows. */
  private async describe<T extends { studentId: string; termId: string }>(rows: T[]) {
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.studentId));
    const withTerms = await this.studentClient.withTermNames(rows);
    return withTerms.map((r) => ({
      ...r,
      studentName: names.get(r.studentId)?.name ?? '',
      registrationNumber: names.get(r.studentId)?.registrationNumber ?? '',
      className: names.get(r.studentId)?.className ?? null,
    }));
  }

  async byId(id: string, user: RequestUser) {
    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Director roles can only access aggregate finance data');
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { lineItems: true, payments: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (user.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, invoice.studentId);
    } else if (user.role === 'STUDENT') {
      await this.accessControl.assertStudentOwnsRecord(user.id, invoice.studentId);
    } else {
      // Staff: block cross-school access by id (group users pass through).
      assertSchoolInScope(user, invoice.schoolId ?? null);
    }

    const [described] = await this.describe([invoice]);
    return { ...invoice, ...described, school: await this.studentClient.schoolProfile(invoice.schoolId) };
  }

  async byStudent(studentId: string, user: RequestUser) {
    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Director roles can only access aggregate finance data');
    }

    if (user.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user.role === 'STUDENT') {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }

    const staff = user.role !== 'PARENT' && user.role !== 'STUDENT';
    return this.describe(await this.prisma.invoice.findMany({
      where: { studentId, ...(staff ? schoolScopeFilter(user) : {}) },
      include: { lineItems: true, payments: true },
      orderBy: { createdAt: 'desc' },
    }));
  }

  /** Cancelled, waived and fully settled invoices are closed to further changes. */
  private assertOpen(invoice: { status: InvoiceStatus; invoiceNumber: string }): void {
    const closed: InvoiceStatus[] = [InvoiceStatus.CANCELLED, InvoiceStatus.WAIVED, InvoiceStatus.PAID];
    if (closed.includes(invoice.status)) {
      throw new BadRequestException(`Invoice ${invoice.invoiceNumber} is ${invoice.status.toLowerCase()} and can no longer be changed`);
    }
  }

  /** Payments still waiting for approval cannot be applied to an invoice that is being closed. */
  private async rejectPendingPayments(invoiceId: string, reason: string, user: RequestUser): Promise<void> {
    const pending = await this.prisma.payment.findMany({ where: { invoiceId, status: PaymentStatus.PENDING }, select: { id: true } });
    if (!pending.length) return;
    const ids = pending.map((p) => p.id);
    await this.prisma.$transaction([
      this.prisma.manualPaymentApproval.updateMany({
        where: { paymentId: { in: ids }, decision: null },
        data: { decision: 'REJECTED', reviewedAt: new Date(), reviewedById: user.id, rejectionReason: reason },
      }),
      this.prisma.payment.updateMany({
        where: { id: { in: ids } },
        data: { status: PaymentStatus.REJECTED, approvalStatus: 'REJECTED', rejectedAt: new Date(), rejectedById: user.id, rejectionReason: reason },
      }),
    ]);
  }

  async applyDiscount(id: string, discountAmount: string, discountReason: string, user: RequestUser) {
    const invoice = await this.byId(id, user);
    if (!discountReason?.trim()) throw new BadRequestException('A reason is required for a discount');
    this.assertOpen(invoice);
    const discount = this.decimal(discountAmount);
    // The discount replaces any earlier one, and can never push the balance below zero.
    const maxDiscount = invoice.subtotal.minus(invoice.paidAmount);
    if (discount.lt(0) || discount.gt(maxDiscount)) {
      throw new BadRequestException(`Invalid discount amount — maximum allowable discount is ${maxDiscount.toString()}`);
    }

    const total = invoice.subtotal.minus(discount);
    const outstanding = total.minus(invoice.paidAmount);
    const status = this.status(total, invoice.paidAmount, invoice.dueDate);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        discountAmount: discount,
        discountReason,
        totalAmount: total,
        outstandingBalance: outstanding,
        status,
      },
    });

    await this.audit.log({
      entityType: 'Invoice',
      entityId: id,
      action: FinancialAuditAction.INVOICE_DISCOUNT_APPLIED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: invoice,
      newValue: updated,
    });
    await this.redis.del(`student-balance:${invoice.studentId}`);
    return updated;
  }

  async cancel(id: string, reason: string, user: RequestUser) {
    const invoice = await this.byId(id, user);
    this.assertOpen(invoice);
    if (!reason?.trim()) throw new BadRequestException('A reason is required to cancel an invoice');
    if (invoice.payments.some((p) => p.status === PaymentStatus.CONFIRMED)) {
      throw new ConflictException('Cannot cancel invoice with confirmed payment');
    }
    await this.rejectPendingPayments(id, `Invoice cancelled: ${reason}`, user);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancellationReason: reason,
        outstandingBalance: new Prisma.Decimal(0),
      },
    });

    await this.audit.log({
      entityType: 'Invoice',
      entityId: id,
      action: FinancialAuditAction.INVOICE_CANCELLED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: invoice,
      newValue: updated,
    });
    return updated;
  }

  async waive(id: string, reason: string, user: RequestUser) {
    const invoice = await this.byId(id, user);
    if (([InvoiceStatus.CANCELLED, InvoiceStatus.PAID, InvoiceStatus.WAIVED] as InvoiceStatus[]).includes(invoice.status)) {
      throw new BadRequestException(`Cannot waive an invoice that is already ${invoice.status.toLowerCase()}`);
    }
    if (!reason?.trim()) throw new BadRequestException('A reason is required to waive an invoice');
    await this.rejectPendingPayments(id, `Invoice waived: ${reason}`, user);
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.WAIVED,
        waiverReason: reason,
        waivedAt: new Date(),
        waivedById: user.id,
        outstandingBalance: new Prisma.Decimal(0),
      },
    });

    await this.audit.log({
      entityType: 'Invoice',
      entityId: id,
      action: FinancialAuditAction.INVOICE_WAIVED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: invoice,
      newValue: updated,
    });
    return updated;
  }

  async getPdfFile(id: string, user: RequestUser) {
    let invoice = await this.byId(id, user);
    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    // Drawn fresh on every download so it always shows the current paid amount and status.
    await this.regeneratePdf(id, user);
    invoice = await this.byId(id, user);
    if (!invoice.pdfUrl) throw new NotFoundException('Invoice PDF not found');
    const fullPath = join(root, invoice.pdfUrl);
    if (!existsSync(fullPath)) throw new NotFoundException('Invoice PDF could not be produced');

    return {
      fullPath,
      fileName: `${invoice.invoiceNumber}.pdf`,
    };
  }

  async regeneratePdf(id: string, user: RequestUser) {
    await this.byId(id, user);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    let student: any = {};
    try {
      student = this.unwrap<any>(
        await this.studentClient.get(
          `/students/${invoice.studentId}`,
          {},
          {
            'X-User-Id': 'finance-service',
            'X-User-Role': 'PRINCIPAL',
          },
        ),
      );
    } catch {
      student = {};
    }

    const pdfUrl = await this.pdf.generate({
      invoiceNumber: invoice.invoiceNumber,
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || invoice.studentId,
      registrationNumber: student.registrationNumber || '-',
      className: student.enrolments?.[0]?.class?.name || invoice.classId,
      termId: invoice.termId,
      academicYearId: invoice.academicYearId,
      termName: (await this.studentClient.termLabels()).get(invoice.termId)?.name ?? null,
      academicYearName: (await this.studentClient.termLabels()).get(invoice.termId)?.academicYearName ?? null,
      school: await this.studentClient.schoolProfile(invoice.schoolId),
      status: invoice.status,
      lineItems: invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      outstandingBalance: invoice.outstandingBalance.toString(),
      dueDate: invoice.dueDate,
    });

    return this.prisma.invoice.update({ where: { id }, data: { pdfUrl } });
  }
}
