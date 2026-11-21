import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialAuditAction, InvoiceStatus, PaymentStatus, Prisma, ResidenceType } from '../../generated/prisma';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { AccessControlService } from '../common/helpers/access-control.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSort } from '../common/helpers/sort.helper';
import { schoolScopeFilter, assertSchoolInScope, schoolInScope } from '../common/helpers/school-scope.helper';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { InvoicePdfData, InvoicePdfService } from './invoice-pdf.service';
import { PaymentPlansService } from '../payment-plans/payment-plans.service';
import { FinanceSettingsService } from '../finance-settings/finance-settings.service';
import { selectApplicableStructures } from '../fee-structures/fee-matching';
import { ApplyFeeRecalculationDto } from './dto/apply-fee-recalculation.dto';
import { allocatePaid } from '../payment-plans/plan-schedule';

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

/** One class id, or several joined by commas (every stream of a class level), as a Prisma filter. */
export function classIdFilter(value: unknown): string | { in: string[] } | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return undefined;
  const ids = text.split(',').map((v) => v.trim()).filter(Boolean);
  return ids.length > 1 ? { in: ids } : ids[0];
}

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
    private readonly plans: PaymentPlansService,
    private readonly settings: FinanceSettingsService,
  ) {}


  /** Everything the invoice PDF prints, read fresh from the database so it always shows the current paid amount and plan. */
  private async pdfDataFor(
    invoice: Prisma.InvoiceGetPayload<{ include: { lineItems: true } }>,
    student: any,
    className: string,
  ): Promise<InvoicePdfData> {
    const labels = await this.studentClient.termLabels();
    const [school, accounts, branding, installments, previous] = await Promise.all([
      this.studentClient.schoolProfile(invoice.schoolId),
      this.settings.activeAccountsForSchool(invoice.schoolId),
      this.settings.brandingForPdf(invoice.schoolId),
      this.prisma.invoiceInstallment.findMany({ where: { invoiceId: invoice.id }, orderBy: { sequence: 'asc' } }),
      this.prisma.invoice.aggregate({
        _sum: { outstandingBalance: true },
        where: {
          studentId: invoice.studentId,
          id: { not: invoice.id },
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
          createdAt: { lt: invoice.createdAt },
        },
      }),
    ]);
    let remaining = Number(invoice.paidAmount);
    const lineItems = invoice.lineItems.map((item) => {
      const amount = Number(item.amount);
      const paid = Math.min(remaining, amount);
      remaining -= paid;
      return { name: item.feeCategoryName, amount, paid, balance: amount - paid };
    });
    const discount = Number(invoice.discountAmount ?? 0);
    if (discount > 0) lineItems.push({ name: 'Discount', amount: -discount, paid: 0, balance: -discount });
    const paidSoFar = Number(invoice.paidAmount);
    const schedule = allocatePaid(installments.map((r) => ({ ...r, amount: Number(r.amount) })), paidSoFar);
    return {
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.issuedAt ?? invoice.createdAt,
      dueDate: invoice.dueDate,
      status: invoice.status,
      studentName: `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim() || invoice.studentId,
      registrationNumber: student?.registrationNumber || '-',
      className,
      academicYearName: labels.get(invoice.termId)?.academicYearName ?? null,
      termName: labels.get(invoice.termId)?.name ?? null,
      school,
      branding,
      lineItems,
      installments: schedule.map((r) => ({ groupLabel: r.groupLabel, label: r.label, description: r.description, dueDate: r.dueDate, amount: r.amount, balance: r.balance })),
      accounts: accounts.map((a) => ({ bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, description: a.description })),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: paidSoFar,
      previousBalance: Number(previous._sum.outstandingBalance ?? 0),
      outstandingBalance: Number(invoice.outstandingBalance),
    };
  }

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

  private async applicableStructures(input: {
    studentId: string;
    schoolId: string | null;
    classId: string;
    educationStage?: string | null;
    classLevel?: number | null;
    residenceType?: ResidenceType | null;
    academicYearId: string;
    termId: string;
  }) {
    const [groupMemberships, assignments, structures] = await Promise.all([
      this.prisma.studentGroupMembership.findMany({
        where: { studentId: input.studentId, isActive: true, group: { isActive: true } },
        include: { group: true },
      }),
      this.prisma.studentFeeAssignment.findMany({
        where: {
          studentId: input.studentId,
          academicYearId: input.academicYearId,
          isActive: true,
          OR: [{ termId: input.termId }, { termId: null }],
        },
      }),
      this.prisma.feeStructure.findMany({
        where: {
          academicYearId: input.academicYearId,
          isActive: true,
          ...(input.schoolId ? { OR: [{ schoolId: input.schoolId }, { schoolId: null }] } : { schoolId: null }),
          AND: [{ OR: [{ termId: input.termId }, { termId: null }] }],
        },
        include: { feeCategory: true },
      }),
    ]);

    return selectApplicableStructures(
      structures,
      {
        schoolId: input.schoolId,
        classId: input.classId,
        educationStage: input.educationStage,
        classLevel: input.classLevel,
        studentGroupCodes: groupMemberships.map((membership) => membership.group.code),
        residenceType: input.residenceType,
        academicYearId: input.academicYearId,
        termId: input.termId,
      },
      new Set(assignments.map((assignment) => assignment.feeCategoryId)),
    );
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

    const schoolId = studentSchoolId;
    const residenceType = Object.values(ResidenceType).includes(student.residenceType) ? student.residenceType as ResidenceType : null;
    const applicable = await this.applicableStructures({
      studentId: student.id,
      schoolId,
      classId,
      educationStage,
      classLevel,
      residenceType,
      academicYearId: dto.academicYearId,
      termId: dto.termId,
    });
    if (!applicable.length) return null;

    const subtotal = applicable.reduce((acc, item) => acc.plus(item.amount), new Prisma.Decimal(0));
    const total = subtotal;
    const grace = Number(this.configService.get<string>('FEE_DUE_GRACE_DAYS', '14'));
    const dueDate = new Date(Date.now() + grace * 24 * 60 * 60 * 1000);
    const invoiceNumber = await this.numberService.invoiceNumber();

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
        residenceType,
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
    // A matching payment plan (if finance has set one up) splits the invoice into instalments.
    try {
      await this.plans.attach(invoice.id, null, actor);
    } catch (err) {
      this.logger.warn(`Payment plan was not attached to ${invoice.invoiceNumber}: ${(err as Error)?.message}`);
    }

    let pdfUrl: string | null = null;
    try {
      pdfUrl = await this.pdf.generate(await this.pdfDataFor(invoice, student, student.enrolments?.[0]?.class?.name || classId));
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

  /** Every student matching the filter, fetched page by page (the student service caps a page at 100). */
  private async allStudents(params: Record<string, unknown>, headers: Record<string, string>): Promise<any[]> {
    const pageSize = 100;
    const seen = new Set<string>();
    const all: any[] = [];
    for (let page = 1; page <= 500; page++) {
      const payload = this.unwrap<any>(await this.studentClient.get<any>('/students', { ...params, page, limit: pageSize }, headers));
      const items: any[] = payload?.items || [];
      let added = 0;
      for (const item of items) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
          added++;
        }
      }
      const totalPages = Number(payload?.meta?.totalPages ?? 0);
      if (items.length < pageSize || added === 0 || (totalPages && page >= totalPages)) break;
    }
    return all;
  }

  private async runGenerationJob(jobId: string, dto: GenerateInvoicesDto, user: RequestUser): Promise<void> {
    InvoicesService.generationJobs.set(jobId, {
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
    });

    try {
      // The student list answers at most 100 per page, so walk every page: a class of 227 students must get 227 invoices.
      const headers = { 'X-User-Id': user.id, 'X-User-Role': user.role };
      const students: any[] = dto.classIds?.length
        ? (await Promise.all(dto.classIds.map((classId) => this.allStudents({ classId }, headers)))).flat()
        : await this.allStudents({}, headers);

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
          classId: classIdFilter(filters.classId),
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
          classId: classIdFilter(filters.classId),
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
        classId: classIdFilter(filters.classId),
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
      classId: classIdFilter(filters.classId),
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
        orderBy: resolveSort(
          filters.sortBy,
          filters.sortDir,
          {
            invoiceNumber: (d) => ({ invoiceNumber: d }),
            dueDate: (d) => ({ dueDate: d }),
            total: (d) => ({ totalAmount: d }),
            paid: (d) => ({ paidAmount: d }),
            outstanding: (d) => ({ outstandingBalance: d }),
            status: (d) => ({ status: d }),
            issuedAt: (d) => ({ issuedAt: d }),
          },
          filters.sort === 'outstanding' ? [{ outstandingBalance: 'desc' }, { invoiceNumber: 'desc' }] : [{ dueDate: 'desc' }, { invoiceNumber: 'desc' }],
          { invoiceNumber: 'desc' },
        ) as any,
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

  async previewFeeRecalculation(id: string, user: RequestUser) {
    await this.byId(id, user);
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { lineItems: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const studentPayload = await this.studentClient.get<any>(
      `/students/${invoice.studentId}`,
      {},
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );
    const student = this.unwrap<any>(studentPayload);
    const residenceType = Object.values(ResidenceType).includes(student?.residenceType)
      ? student.residenceType as ResidenceType
      : null;
    const applicable = await this.applicableStructures({
      studentId: invoice.studentId,
      schoolId: invoice.schoolId,
      classId: invoice.classId,
      educationStage: invoice.educationStage,
      classLevel: invoice.classLevel,
      residenceType,
      academicYearId: invoice.academicYearId,
      termId: invoice.termId,
    });

    const currentLines = invoice.lineItems.map((line) => ({
      feeStructureId: line.feeStructureId,
      feeCategoryId: line.feeCategoryId,
      feeCategoryName: line.feeCategoryName,
      amount: line.amount.toString(),
      currency: line.currency,
    }));
    const proposedLines = applicable.map((structure) => ({
      feeStructureId: structure.id,
      feeCategoryId: structure.feeCategoryId,
      feeCategoryName: structure.feeCategory.name,
      amount: structure.amount.toString(),
      currency: structure.currency,
      residenceType: structure.residenceType,
    }));
    const currentByCategory = new Map(currentLines.map((line) => [line.feeCategoryId, line]));
    const proposedByCategory = new Map(proposedLines.map((line) => [line.feeCategoryId, line]));
    const additions = proposedLines.filter((line) => !currentByCategory.has(line.feeCategoryId));
    const removals = currentLines.filter((line) => !proposedByCategory.has(line.feeCategoryId));
    const amountChanges = proposedLines.flatMap((line) => {
      const current = currentByCategory.get(line.feeCategoryId);
      return current && current.amount !== line.amount ? [{ ...line, previousAmount: current.amount }] : [];
    });
    const proposedSubtotal = proposedLines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    const proposedTotal = Prisma.Decimal.max(proposedSubtotal.minus(invoice.discountAmount), new Prisma.Decimal(0));
    const proposedBalance = proposedTotal.minus(invoice.paidAmount);
    const blockedReasons: string[] = [];
    const safeStatuses: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE];
    if (!safeStatuses.includes(invoice.status)) blockedReasons.push(`Invoice status ${invoice.status} is not eligible for automatic recalculation`);
    if (!residenceType) blockedReasons.push('Student must be classified as Boarding or Day Scholar');
    if (invoice.discountAmount.gt(proposedSubtotal)) blockedReasons.push('The existing discount exceeds the proposed subtotal and requires manual finance review');
    if (proposedTotal.lt(invoice.paidAmount)) blockedReasons.push('Proposed total is below the amount already paid; use the existing manual credit/refund decision path');

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      studentId: invoice.studentId,
      reviewRequired: invoice.feeReviewRequired,
      reviewReason: invoice.feeReviewReason,
      previousResidenceType: invoice.residenceType,
      proposedResidenceType: residenceType,
      currentLines,
      proposedLines,
      additions,
      removals,
      amountChanges,
      currentSubtotal: invoice.subtotal.toString(),
      proposedSubtotal: proposedSubtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      currentTotal: invoice.totalAmount.toString(),
      proposedTotal: proposedTotal.toString(),
      paidAmount: invoice.paidAmount.toString(),
      currentBalance: invoice.outstandingBalance.toString(),
      proposedBalance: proposedBalance.toString(),
      blocked: blockedReasons.length > 0,
      blockedReasons,
    };
  }

  async applyFeeRecalculation(id: string, dto: ApplyFeeRecalculationDto, user: RequestUser) {
    const prior = await this.prisma.invoiceFeeRecalculation.findUnique({
      where: { invoiceId_idempotencyKey: { invoiceId: id, idempotencyKey: dto.idempotencyKey } },
    });
    if (prior) return { alreadyApplied: true, invoice: await this.byId(id, user), recalculation: prior };

    const preview = await this.previewFeeRecalculation(id, user);
    if (preview.blocked) throw new ConflictException(preview.blockedReasons.join('; '));
    if (!dto.reason.trim()) throw new BadRequestException('A recalculation reason is required');

    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { lineItems: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const proposedSubtotal = this.decimal(preview.proposedSubtotal);
    const proposedTotal = this.decimal(preview.proposedTotal);
    const proposedBalance = this.decimal(preview.proposedBalance);
    const newStatus = this.status(proposedTotal, invoice.paidAmount, invoice.dueDate);

    const result = await this.prisma.$transaction(async (tx) => {
      const recalculation = await tx.invoiceFeeRecalculation.create({
        data: {
          invoiceId: id,
          idempotencyKey: dto.idempotencyKey,
          reason: dto.reason.trim(),
          previousResidence: invoice.residenceType,
          proposedResidence: preview.proposedResidenceType,
          previousSubtotal: invoice.subtotal,
          proposedSubtotal,
          previousTotal: invoice.totalAmount,
          proposedTotal,
          paidAmount: invoice.paidAmount,
          previousLines: preview.currentLines as Prisma.InputJsonValue,
          proposedLines: preview.proposedLines as Prisma.InputJsonValue,
          performedById: user.id,
          performedByRole: user.role,
        },
      });
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      for (const line of preview.proposedLines) {
        await tx.invoiceLineItem.create({
          data: {
            invoiceId: id,
            feeStructureId: line.feeStructureId,
            feeCategoryId: line.feeCategoryId,
            feeCategoryName: line.feeCategoryName,
            amount: this.decimal(line.amount),
            currency: line.currency,
          },
        });
      }
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          subtotal: proposedSubtotal,
          totalAmount: proposedTotal,
          outstandingBalance: proposedBalance,
          status: newStatus,
          residenceType: preview.proposedResidenceType,
          feeReviewRequired: false,
          feeReviewReason: null,
          feeReviewMarkedAt: null,
        },
        include: { lineItems: true, payments: true },
      });
      return { updated, recalculation };
    });

    await this.audit.log({
      entityType: 'Invoice',
      entityId: id,
      action: FinancialAuditAction.INVOICE_FEE_RECALCULATED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: invoice,
      newValue: result.updated,
      metadata: { reason: dto.reason.trim(), idempotencyKey: dto.idempotencyKey, recalculationId: result.recalculation.id },
    });
    await this.redis.del(`student-balance:${invoice.studentId}`);
    await this.plans.refreshAfterChange(id, user);
    return { alreadyApplied: false, invoice: result.updated, recalculation: result.recalculation };
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
    await this.plans.refreshAfterChange(id, user);
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

  /** Tell the student's guardian about this invoice again (the notification service delivers it by their preferred channels). */
  async notifyParent(id: string, user: RequestUser) {
    const invoice = await this.byId(id, user);
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('A cancelled invoice cannot be sent');
    await this.rabbitMq.publish('invoice.generated', {
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      totalAmount: invoice.outstandingBalance.toString(),
      dueDate: invoice.dueDate.toISOString(),
      termId: invoice.termId,
      resend: true,
    });
    await this.audit.log({
      entityType: 'Invoice',
      entityId: id,
      action: FinancialAuditAction.INVOICE_ISSUED,
      performedById: user.id,
      performedByRole: user.role,
      metadata: { schoolId: invoice.schoolId, resentToParent: true },
    });
    return { sent: true, invoiceId: id };
  }

  /** A made-up invoice drawn with the school real branding, payment accounts and an example payment plan. */
  async samplePdf(user: RequestUser) {
    const schoolId = user.activeSchoolId ?? (user.schoolIds ?? []).filter((id) => id && id !== '*')[0] ?? null;
    if (!schoolId) throw new BadRequestException('Select a school first (use the school switcher at the top).');
    assertSchoolInScope(user, schoolId);
    const [school, accounts, branding] = await Promise.all([
      this.studentClient.schoolProfile(schoolId),
      this.settings.activeAccountsForSchool(schoolId),
      this.settings.brandingForPdf(schoolId),
    ]);
    const issued = new Date();
    const day = 24 * 60 * 60 * 1000;
    const lines = [
      { name: 'Tuition Fee', amount: 4740000 },
      { name: 'Admission form', amount: 200000 },
      { name: 'Development fee', amount: 400000 },
      { name: 'Text book', amount: 600000 },
    ].map((l) => ({ ...l, paid: 0, balance: l.amount }));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const pdfPath = await this.pdf.generate({
      invoiceNumber: 'SAMPLE',
      createdAt: issued,
      dueDate: new Date(issued.getTime() + 14 * day),
      status: 'ISSUED',
      studentName: 'SAMPLE STUDENT NAME',
      registrationNumber: 'REG/0001',
      className: 'Class 4',
      academicYearName: String(issued.getFullYear()),
      termName: 'Term 1',
      school,
      branding,
      lineItems: lines,
      installments: [
        { groupLabel: 'Term I', label: 'First installment (50%)', description: 'Tuition Fee', dueDate: new Date(issued.getTime() + 30 * day), amount: 2370000, balance: 2370000 },
        { groupLabel: 'Term II', label: 'Second installment (50%)', description: 'Tuition Fee', dueDate: new Date(issued.getTime() + 120 * day), amount: 2370000, balance: 2370000 },
        { groupLabel: null, label: 'Other items', description: 'Admission form (200,000), Development fee (400,000), Text book (600,000)', dueDate: issued, amount: 1200000, balance: 1200000 },
      ],
      accounts: accounts.map((a) => ({ bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, description: a.description })),
      totalAmount: total,
      paidAmount: 0,
      previousBalance: 0,
      outstandingBalance: total,
    });
    return { fullPath: join(this.configService.get<string>('PDF_STORAGE_PATH', './storage'), pdfPath) };
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

    const pdfUrl = await this.pdf.generate(await this.pdfDataFor(invoice, student, student.enrolments?.[0]?.class?.name || invoice.classId));

    return this.prisma.invoice.update({ where: { id }, data: { pdfUrl } });
  }
}
