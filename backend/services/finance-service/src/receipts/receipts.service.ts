import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialAuditAction, Prisma } from '../../generated/prisma';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuditService } from '../audit/audit.service';
import { AccessControlService } from '../common/helpers/access-control.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { ReceiptPdfService } from './receipt-pdf.service';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
    private readonly studentClient: StudentClientService,
    private readonly rabbitMq: RabbitMqService,
    private readonly pdfService: ReceiptPdfService,
    private readonly accessControl: AccessControlService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }
    return payload as T;
  }

  async issueFromPayment(paymentId: string, actor: RequestUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { include: { lineItems: true } }, receipt: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.receipt) return payment.receipt;

    // A receipt belongs to the school that issued the invoice, whoever happens to approve the payment.
    const receiptSchoolId = payment.schoolId ?? payment.invoice.schoolId ?? actor.activeSchoolId ?? actor.schoolIds?.find((id) => id !== '*') ?? null;
    const receiptNumber = await this.numberService.receiptNumber(receiptSchoolId);

    const student = this.unwrap<any>(
      await this.studentClient.get(`/students/${payment.studentId}`, {}, {
        'X-User-Id': actor.id,
        'X-User-Role': actor.role,
      }),
    );

    const pdfUrl = await this.pdfService.generate({
      receiptNumber,
      paymentDate: payment.paidAt || new Date(),
      paymentMethod: payment.method,
      referenceNumber: payment.referenceNumber,
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || payment.studentId,
      registrationNumber: student.registrationNumber || '-',
      className: student.enrolments?.[0]?.class?.name || payment.invoice.classId,
      academicYearId: payment.invoice.academicYearId,
      termId: payment.invoice.termId,
      termName: (await this.studentClient.termLabels()).get(payment.invoice.termId)?.name ?? null,
      academicYearName: (await this.studentClient.termLabels()).get(payment.invoice.termId)?.academicYearName ?? null,
      invoiceNumber: payment.invoice.invoiceNumber,
      school: await this.studentClient.schoolProfile(receiptSchoolId),
      lineItems: payment.invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
      previousBalance: payment.invoice.outstandingBalance.plus(payment.amount).toString(),
      amountPaid: payment.amount.toString(),
      remainingBalance: payment.invoice.outstandingBalance.toString(),
      issuedByName: 'the finance office',
      issuedAt: new Date(),
    });

    const receipt = await this.prisma.receipt.create({
      data: {
        receiptNumber,
        schoolId: receiptSchoolId,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        studentId: payment.studentId,
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || payment.studentId,
        classId: payment.invoice.classId,
        educationStage: payment.invoice.educationStage,
        classLevel: payment.invoice.classLevel,
        termId: payment.invoice.termId,
        academicYearId: payment.invoice.academicYearId,
        amount: payment.amount,
        method: payment.method,
        referenceNumber: payment.referenceNumber,
        paidAt: payment.paidAt || new Date(),
        issuedById: actor.id,
        pdfUrl,
      },
    });

    await this.prisma.payment.update({ where: { id: payment.id }, data: { receiptId: receipt.id } });

    await this.audit.log({
      entityType: 'Receipt',
      entityId: receipt.id,
      action: FinancialAuditAction.RECEIPT_ISSUED,
      performedById: actor.id,
      performedByRole: actor.role,
      newValue: receipt,
    });

    await this.rabbitMq.publish('receipt.generated', {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      studentId: receipt.studentId,
      pdfUrl: receipt.pdfUrl,
    });

    return receipt;
  }

  async list(filters: any, user: RequestUser) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Director roles can only access aggregate finance data');
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
        throw new ForbiddenException('Student can only access own receipts');
      }
      studentFilter = ownStudentId;
    }

    if (user.role === 'PARENT') {
      const studentIds = await this.accessControl.resolveGuardianStudentIds(user.id);
      if (!studentIds.length) {
        return [];
      }
      if (studentFilter && !studentIds.includes(studentFilter)) {
        throw new ForbiddenException('Parent can only access own child receipts');
      }
      studentFilter = studentFilter || undefined;

      return this.studentClient.withTermNames(await this.prisma.receipt.findMany({
        where: {
          studentId: studentFilter || { in: studentIds },
          termId: filters.termId,
          method: filters.method,
          issuedAt:
            filters.startDate || filters.endDate
              ? {
                  gte: filters.startDate ? new Date(filters.startDate) : undefined,
                  lte: filters.endDate ? new Date(filters.endDate) : undefined,
                }
              : undefined,
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }));
    }

    return this.studentClient.withTermNames(await this.prisma.receipt.findMany({
      where: {
        ...schoolScopeFilter(user),
        studentId: studentFilter,
        termId: filters.termId,
        method: filters.method,
        issuedAt:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
              }
            : undefined,
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }));
  }

  /** One page of the receipt ledger plus totals and active/void counts for everything that matches. */
  private async listPaged(filters: any, user: RequestUser, page: number, limit: number) {
    const base: Prisma.ReceiptWhereInput = {
      ...schoolScopeFilter(user),
      studentId: filters.studentId || undefined,
      termId: filters.termId || undefined,
      method: filters.method || undefined,
      issuedAt:
        filters.startDate || filters.endDate
          ? { gte: filters.startDate ? new Date(filters.startDate) : undefined, lte: filters.endDate ? new Date(filters.endDate) : undefined }
          : undefined,
    };
    const q = String(filters.search ?? filters.q ?? '').trim();
    if (q) {
      base.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { studentName: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { payment: { paymentNumber: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const state = String(filters.state ?? '').trim().toUpperCase();
    const where: Prisma.ReceiptWhereInput = { ...base, ...(state === 'VOID' ? { isVoided: true } : state === 'ACTIVE' ? { isVoided: false } : {}) };

    const [rows, total, active, voided, sums] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        include: { payment: { select: { paymentNumber: true } }, invoice: { select: { invoiceNumber: true } } },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.receipt.count({ where }),
      this.prisma.receipt.count({ where: { ...base, isVoided: false } }),
      this.prisma.receipt.count({ where: { ...base, isVoided: true } }),
      this.prisma.receipt.aggregate({ where: { ...where, isVoided: false }, _sum: { amount: true } }),
    ]);
    const items = await this.studentClient.withTermNames(rows);
    return {
      items: items.map((r) => ({ ...r, paymentNumber: r.payment?.paymentNumber, invoiceNumber: r.invoice?.invoiceNumber, status: r.isVoided ? 'VOID' : 'ACTIVE' })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      totals: { activeAmount: (sums._sum.amount ?? new Prisma.Decimal(0)).toString() },
      counts: { ALL: active + voided, ACTIVE: active, VOID: voided },
    };
  }

  async byId(id: string, user: RequestUser) {
    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Director roles can only access aggregate finance data');
    }

    const row = await this.prisma.receipt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Receipt not found');

    if (user.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, row.studentId);
    } else if (user.role === 'STUDENT') {
      await this.accessControl.assertStudentOwnsRecord(user.id, row.studentId);
    } else {
      assertSchoolInScope(user, row.schoolId ?? null);
    }

    const [withTerm] = await this.studentClient.withTermNames([row]);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: row.invoiceId },
      select: { invoiceNumber: true, totalAmount: true, outstandingBalance: true, dueDate: true, lineItems: { select: { feeCategoryName: true, amount: true } } },
    });
    const names = await this.studentClient.lookupStudents([row.studentId]);
    const student = names.get(row.studentId);
    return {
      ...withTerm,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      invoice: invoice ?? undefined,
      outstandingBalance: invoice?.outstandingBalance ?? undefined,
      registrationNumber: student?.registrationNumber ?? '',
      className: student?.className ?? null,
      school: await this.studentClient.schoolProfile(row.schoolId ?? undefined),
    };
  }

  /** Draws the receipt PDF again from stored data (the file went missing or was never made). */
  private async regeneratePdf(id: string) {
    const row = await this.prisma.receipt.findUnique({ where: { id }, include: { invoice: { include: { lineItems: true } }, payment: true } });
    if (!row) throw new NotFoundException('Receipt not found');
    let student: any = {};
    try {
      student = this.unwrap<any>(await this.studentClient.get(`/students/${row.studentId}`, {}, { 'X-User-Id': 'finance-service', 'X-User-Role': 'PRINCIPAL' }));
    } catch {
      student = {};
    }
    const pdfUrl = await this.pdfService.generate({
      receiptNumber: row.receiptNumber,
      paymentDate: row.paidAt,
      paymentMethod: row.method,
      referenceNumber: row.referenceNumber,
      studentName: row.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || row.studentId,
      registrationNumber: student.registrationNumber || '-',
      className: student.enrolments?.[0]?.class?.name || row.classId,
      academicYearId: row.academicYearId,
      termId: row.termId,
      termName: (await this.studentClient.termLabels()).get(row.termId)?.name ?? null,
      academicYearName: (await this.studentClient.termLabels()).get(row.termId)?.academicYearName ?? null,
      invoiceNumber: row.invoice.invoiceNumber,
      school: await this.studentClient.schoolProfile(row.schoolId ?? row.invoice.schoolId),
      voided: row.isVoided,
      lineItems: row.invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
      previousBalance: row.invoice.outstandingBalance.plus(row.amount).toString(),
      amountPaid: row.amount.toString(),
      remainingBalance: row.invoice.outstandingBalance.toString(),
      issuedByName: 'the finance office',
      issuedAt: row.issuedAt,
    });
    return this.prisma.receipt.update({ where: { id }, data: { pdfUrl } });
  }

  async getPdfFile(id: string, user: RequestUser) {
    let receipt: { id: string; pdfUrl: string | null; receiptNumber: string } = await this.byId(id, user);
    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    // Drawn fresh so a voided receipt is stamped void and the layout is always the current one.
    await this.regeneratePdf(receipt.id);
    receipt = await this.byId(id, user);
    if (!receipt.pdfUrl) throw new NotFoundException('Receipt PDF not found');
    const fullPath = join(root, receipt.pdfUrl);
    if (!existsSync(fullPath)) throw new NotFoundException('Receipt PDF could not be produced');

    return {
      fullPath,
      fileName: `${receipt.receiptNumber}.pdf`,
    };
  }

  async void(id: string, voidReason: string, user: RequestUser) {
    const existing = await this.byId(id, user);
    if (existing.isVoided) throw new BadRequestException('This receipt is already void');
    if (!voidReason?.trim()) throw new BadRequestException('A reason is required to void a receipt');
    const updated = await this.prisma.receipt.update({
      where: { id },
      data: {
        isVoided: true,
        voidReason,
        voidedById: user.id,
        voidedAt: new Date(),
      },
    });

    await this.audit.log({
      entityType: 'Receipt',
      entityId: id,
      action: FinancialAuditAction.RECEIPT_VOIDED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  }
}
