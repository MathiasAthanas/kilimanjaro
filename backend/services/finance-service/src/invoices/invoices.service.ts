import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialAuditAction, InvoiceStatus, Prisma } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { AccessControlService } from '../common/helpers/access-control.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
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

    const [structures, assignments] = await Promise.all([
      this.prisma.feeStructure.findMany({
        where: {
          academicYearId: dto.academicYearId,
          isActive: true,
          AND: [
            { OR: [{ termId: dto.termId }, { termId: null }] },
            { OR: [{ classId }, { classLevel: student.enrolments?.[0]?.class?.level ?? undefined }] },
          ],
        },
        include: { feeCategory: true },
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

    const optionalSet = new Set(assignments.map((a) => a.feeCategoryId));
    const applicable = structures.filter((s) => !s.feeCategory.isOptional || optionalSet.has(s.feeCategoryId));
    if (!applicable.length) return null;

    const subtotal = applicable.reduce((acc, item) => acc.plus(item.amount), new Prisma.Decimal(0));
    const total = subtotal;
    const grace = Number(this.configService.get<string>('FEE_DUE_GRACE_DAYS', '14'));
    const dueDate = new Date(Date.now() + grace * 24 * 60 * 60 * 1000);
    const invoiceNumber = await this.numberService.invoiceNumber(dto.termId.replace(/[^A-Za-z0-9]/g, '').toUpperCase());

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        studentId: student.id,
        classId,
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

    const pdfUrl = await this.pdf.generate({
      invoiceNumber: invoice.invoiceNumber,
      studentName: `${student.firstName} ${student.lastName}`,
      registrationNumber: student.registrationNumber,
      className: student.enrolments?.[0]?.class?.name || classId,
      termId: dto.termId,
      academicYearId: dto.academicYearId,
      lineItems: invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      outstandingBalance: invoice.outstandingBalance.toString(),
      dueDate: invoice.dueDate,
    });

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
                '/api/v1/students',
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
              '/api/v1/students',
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
        } catch {
          failed += 1;
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
          termId: filters.termId,
          academicYearId: filters.academicYearId,
          classId: filters.classId,
          status: filters.status,
        },
      });
      return { aggregateOnly: true, ...aggregate };
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

      return this.prisma.invoice.findMany({
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
      });
    }

    return this.prisma.invoice.findMany({
      where: {
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
  }

  async byId(id: string, user: RequestUser) {
    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Director roles can only access aggregate finance data');
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { lineItems: true, payments: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (user.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, invoice.studentId);
    }
    if (user.role === 'STUDENT') {
      await this.accessControl.assertStudentOwnsRecord(user.id, invoice.studentId);
    }

    return invoice;
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

    return this.prisma.invoice.findMany({
      where: { studentId },
      include: { lineItems: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyDiscount(id: string, discountAmount: string, discountReason: string, user: RequestUser) {
    const invoice = await this.byId(id, user);
    const discount = this.decimal(discountAmount);
    if (discount.lt(0) || discount.gt(invoice.subtotal)) {
      throw new BadRequestException('Invalid discount amount');
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
    if (invoice.payments.some((p) => p.status === 'CONFIRMED')) {
      throw new ConflictException('Cannot cancel invoice with confirmed payment');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancellationReason: reason,
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
    const invoice = await this.byId(id, user);
    if (!invoice.pdfUrl) {
      throw new NotFoundException('Invoice PDF not found');
    }

    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    const fullPath = join(root, invoice.pdfUrl);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Invoice PDF file missing on disk');
    }

    return {
      fullPath,
      fileName: `${invoice.invoiceNumber}.pdf`,
    };
  }

  async regeneratePdf(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const student = this.unwrap<any>(
      await this.studentClient.get(
        `/api/v1/students/${invoice.studentId}`,
        {},
        {
          'X-User-Id': 'finance-service',
          'X-User-Role': 'PRINCIPAL',
        },
      ),
    );

    const pdfUrl = await this.pdf.generate({
      invoiceNumber: invoice.invoiceNumber,
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      registrationNumber: student.registrationNumber || '-',
      className: student.enrolments?.[0]?.class?.name || invoice.classId,
      termId: invoice.termId,
      academicYearId: invoice.academicYearId,
      lineItems: invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      outstandingBalance: invoice.outstandingBalance.toString(),
      dueDate: invoice.dueDate,
    });

    return this.prisma.invoice.update({ where: { id }, data: { pdfUrl } });
  }
}
