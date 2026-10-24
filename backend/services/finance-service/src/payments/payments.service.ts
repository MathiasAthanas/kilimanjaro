import { createHmac, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  FinancialAuditAction,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter, assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { ReceiptsService } from '../receipts/receipts.service';
import { StudentClientService } from '../student-client/student-client.service';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly numberService: NumberSequenceService,
    private readonly audit: AuditService,
    private readonly rabbitMq: RabbitMqService,
    private readonly receiptsService: ReceiptsService,
    private readonly studentClient: StudentClientService,
  ) {}

  private decimal(value: string | number): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private status(total: Prisma.Decimal, paid: Prisma.Decimal, dueDate: Date): InvoiceStatus {
    const outstanding = total.minus(paid);
    if (outstanding.lte(0)) return InvoiceStatus.PAID;
    if (paid.gt(0) && outstanding.gt(0)) return dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.PARTIALLY_PAID;
    return dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.ISSUED;
  }

  private verifyWebhook(bodyRaw: string, signature: string): boolean {
    const secret = this.configService.get<string>('WEBHOOK_SECRET', '');
    const hash = createHmac('sha256', secret).update(bodyRaw).digest('hex');
    const expected = Buffer.from(hash, 'hex');
    const received = Buffer.from(signature || '', 'hex');
    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(expected, received);
  }

  private async applyPaymentToInvoice(paymentId: string, actor: RequestUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    // Atomic increment — prevents concurrent payments from corrupting the balance
    // via a read-modify-write race. The updated invoice is re-read for status computation.
    const updatedInvoice = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const paidAmount = invoice.paidAmount.plus(payment.amount);
      // Money that already arrived (mobile money) can exceed what is owed; the balance floors at zero
      // and the overpayment is flagged on the payment instead of producing a negative balance.
      const rawOutstanding = invoice.totalAmount.minus(paidAmount);
      const outstanding = rawOutstanding.lt(0) ? new Prisma.Decimal(0) : rawOutstanding;
      const status = this.status(invoice.totalAmount, paidAmount, invoice.dueDate);
      if (rawOutstanding.lt(0)) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { notes: `${payment.notes ? `${payment.notes} ` : ''}Overpayment of ${rawOutstanding.abs().toString()} received.`.trim() },
        });
      }

      return tx.invoice.update({
        where: { id: invoice.id },
        data: { paidAmount, outstandingBalance: outstanding, status },
      });
    });

    const receipt = await this.receiptsService.issueFromPayment(payment.id, actor);

    await this.rabbitMq.publish('payment.confirmed', {
      paymentId: payment.id,
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      method: payment.method,
      receiptNumber: receipt.receiptNumber,
      invoiceId: payment.invoiceId,
    });

    await this.rabbitMq.publish('finance.payment.recorded', {
      paymentId: payment.id,
      amount: payment.amount.toString(),
      method: payment.method,
      termId: updatedInvoice.termId,
    });

    return { payment, receipt };
  }

  async mobileWebhook(input: {
    bodyRaw: string;
    signature: string;
    payload: {
      transactionId: string;
      phoneNumber?: string;
      amount: number;
      currency?: string;
      reference: string;
      timestamp?: string;
      payerName?: string;
    };
  }) {
    if (!this.verifyWebhook(input.bodyRaw, input.signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const webhookAmount = Number(input.payload.amount);
    if (!webhookAmount || webhookAmount <= 0) {
      return { accepted: false, reason: 'Invalid amount' };
    }

    const existing = await this.prisma.payment.findFirst({ where: { referenceNumber: input.payload.transactionId } });
    if (existing) return { accepted: true, idempotent: true };

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [{ id: input.payload.reference }, { invoiceNumber: input.payload.reference }],
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
    });

    if (!invoice) return { accepted: true, ignored: true };

    const payment = await this.prisma.payment.create({
      data: {
        paymentNumber: await this.numberService.paymentNumber((invoice as any).schoolId ?? null),
        invoiceId: invoice.id,
        schoolId: (invoice as any).schoolId ?? null,
        studentId: invoice.studentId,
        amount: this.decimal(input.payload.amount),
        currency: input.payload.currency || 'TZS',
        method: PaymentMethod.MOBILE_MONEY,
        status: PaymentStatus.CONFIRMED,
        referenceNumber: input.payload.transactionId,
        payerName: input.payload.payerName,
        payerPhone: input.payload.phoneNumber,
        paidAt: input.payload.timestamp ? new Date(input.payload.timestamp) : new Date(),
        confirmedAt: new Date(),
        requiresApproval: false,
        webhookPayload: input.payload as any,
      },
    });

    const actor = { id: 'webhook', role: 'SYSTEM_ADMIN' } as RequestUser;
    await this.applyPaymentToInvoice(payment.id, actor);

    await this.audit.log({
      entityType: 'Payment',
      entityId: payment.id,
      action: FinancialAuditAction.PAYMENT_CONFIRMED,
      performedById: actor.id,
      performedByRole: actor.role,
      newValue: payment,
    });

    return { accepted: true };
  }

  /** An invoice can take money while it is open; cancelled, waived or settled ones cannot. */
  private assertPayable(invoice: { status: InvoiceStatus; invoiceNumber: string }): void {
    const open: InvoiceStatus[] = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE];
    if (!open.includes(invoice.status)) {
      throw new BadRequestException(`Invoice ${invoice.invoiceNumber} is ${invoice.status.toLowerCase().replace('_', ' ')} and cannot take a payment`);
    }
  }

  private async createManualPayment(dto: CreateManualPaymentDto, method: PaymentMethod, user: RequestUser) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    assertSchoolInScope(user, invoice.schoolId ?? null);
    this.assertPayable(invoice);

    const amount = this.decimal(dto.amount);
    if (!amount.gt(0)) throw new BadRequestException('Payment amount must be greater than zero');

    // Payments waiting for approval already earmark part of the balance.
    const pending = await this.prisma.payment.aggregate({
      where: { invoiceId: invoice.id, status: PaymentStatus.PENDING },
      _sum: { amount: true },
    });
    const pendingAmount = pending._sum.amount ?? new Prisma.Decimal(0);
    const available = invoice.outstandingBalance.minus(pendingAmount);
    if (amount.gt(available)) {
      throw new BadRequestException(
        `Amount exceeds what can still be paid on ${invoice.invoiceNumber}: balance ${invoice.outstandingBalance.toString()}${pendingAmount.gt(0) ? `, of which ${pendingAmount.toString()} is already awaiting approval` : ''}`,
      );
    }

    if (dto.referenceNumber?.trim()) {
      const duplicate = await this.prisma.payment.findFirst({
        where: {
          referenceNumber: dto.referenceNumber.trim(),
          method,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMED] },
          ...(invoice.schoolId ? { schoolId: invoice.schoolId } : {}),
        },
      });
      if (duplicate) throw new ConflictException(`Reference ${dto.referenceNumber.trim()} was already recorded (${duplicate.paymentNumber})`);
    }

    const payment = await this.prisma.payment.create({
      data: {
        paymentNumber: await this.numberService.paymentNumber((invoice as any).schoolId ?? null),
        invoiceId: invoice.id,
        schoolId: invoice.schoolId ?? null,
        studentId: invoice.studentId,
        amount,
        method,
        status: PaymentStatus.PENDING,
        referenceNumber: dto.referenceNumber?.trim() || undefined,
        payerName: dto.payerName,
        payerPhone: dto.payerPhone,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        notes: dto.notes,
        requiresApproval: true,
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      },
    });

    await this.prisma.manualPaymentApproval.create({
      data: {
        paymentId: payment.id,
        requestedById: user.id,
        supportingDocumentUrl: dto.supportingDocumentUrl,
      },
    });

    await this.audit.log({
      entityType: 'Payment',
      entityId: payment.id,
      action: FinancialAuditAction.PAYMENT_RECORDED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: payment,
    });

    return payment;
  }

  bankTransfer(dto: CreateManualPaymentDto, user: RequestUser) {
    return this.createManualPayment(dto, PaymentMethod.BANK_TRANSFER, user);
  }

  cash(dto: CreateManualPaymentDto, user: RequestUser) {
    return this.createManualPayment(dto, PaymentMethod.CASH, user);
  }

  async list(filters: any, user: RequestUser) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    if (filters.paged) return this.listPaged(filters, user, page, limit);
    const rows = await this.prisma.payment.findMany({
      where: {
        ...schoolScopeFilter(user),
        invoiceId: filters.invoiceId,
        studentId: filters.studentId,
        method: filters.method,
        status: filters.status,
        createdAt:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
              }
            : undefined,
      },
      include: { invoice: { select: { invoiceNumber: true } }, receipt: { select: { receiptNumber: true, isVoided: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.studentId));
    return rows.map((r) => ({
      ...r,
      invoiceNumber: r.invoice?.invoiceNumber,
      receiptNumber: r.receipt?.receiptNumber,
      studentName: names.get(r.studentId)?.name ?? '',
      registrationNumber: names.get(r.studentId)?.registrationNumber ?? '',
    }));
  }

  /** One page of the payment ledger plus totals and status counts for everything that matches. */
  private async listPaged(filters: any, user: RequestUser, page: number, limit: number) {
    const base: Prisma.PaymentWhereInput = {
      ...schoolScopeFilter(user),
      invoiceId: filters.invoiceId || undefined,
      studentId: filters.studentId || undefined,
      method: filters.method || undefined,
      paidAt:
        filters.startDate || filters.endDate
          ? { gte: filters.startDate ? new Date(filters.startDate) : undefined, lte: filters.endDate ? new Date(filters.endDate) : undefined }
          : undefined,
    };
    const q = String(filters.search ?? filters.q ?? '').trim();
    if (q) {
      const ids = await this.studentClient.searchStudents(q);
      base.OR = [
        { paymentNumber: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { payerName: { contains: q, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
        ...(ids.length ? [{ studentId: { in: ids } }] : []),
      ];
    }
    const status = String(filters.status ?? '').trim().toUpperCase();
    const where: Prisma.PaymentWhereInput = { ...base, ...(status ? { status: status as PaymentStatus } : {}) };

    const [rows, total, byStatus, confirmed] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { invoice: { select: { invoiceNumber: true } }, receipt: { select: { receiptNumber: true, isVoided: true } } },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({ by: ['status'], where: base, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { ...where, status: PaymentStatus.CONFIRMED }, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.studentId));
    const counts: Record<string, number> = { ALL: 0 };
    const amounts: Record<string, string> = {};
    for (const g of byStatus) {
      counts[g.status] = g._count._all;
      counts.ALL += g._count._all;
      amounts[g.status] = (g._sum.amount ?? new Prisma.Decimal(0)).toString();
    }
    return {
      items: rows.map((r) => ({
        ...r,
        invoiceNumber: r.invoice?.invoiceNumber,
        receiptNumber: r.receipt?.receiptNumber,
        studentName: names.get(r.studentId)?.name ?? '',
        registrationNumber: names.get(r.studentId)?.registrationNumber ?? '',
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      totals: { confirmedAmount: (confirmed._sum.amount ?? new Prisma.Decimal(0)).toString(), confirmedCount: confirmed._count._all },
      counts,
      amounts,
    };
  }

  /** One payment with the invoice, receipt and approval trail it belongs to. */
  async byId(id: string, user: RequestUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: { select: { invoiceNumber: true, totalAmount: true, outstandingBalance: true } },
        receipt: { select: { id: true, receiptNumber: true, isVoided: true } },
        manualApproval: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    assertSchoolInScope(user, payment.schoolId ?? null);
    const names = await this.studentClient.lookupStudents([payment.studentId]);
    const student = names.get(payment.studentId);
    const { invoice, receipt, manualApproval, ...rest } = payment;
    return {
      ...rest,
      invoiceNumber: invoice?.invoiceNumber,
      invoiceTotal: invoice?.totalAmount,
      invoiceOutstanding: invoice?.outstandingBalance,
      receiptId: receipt?.id ?? null,
      receiptNumber: receipt?.receiptNumber ?? null,
      receiptVoided: receipt?.isVoided ?? false,
      studentName: student?.name ?? '',
      registrationNumber: student?.registrationNumber ?? '',
      className: student?.className ?? null,
      approval: manualApproval,
    };
  }

  async pendingApprovals(user: RequestUser) {
    const rows = await this.prisma.manualPaymentApproval.findMany({
      where: {
        decision: null,
        payment: { ...schoolScopeFilter(user) },
      },
      include: { payment: { include: { invoice: { select: { invoiceNumber: true } } } } },
      orderBy: { requestedAt: 'asc' },
    });
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.payment.studentId));
    return rows.map((r) => ({
      ...r,
      studentName: names.get(r.payment.studentId)?.name ?? '',
      registrationNumber: names.get(r.payment.studentId)?.registrationNumber ?? '',
      invoiceNumber: r.payment.invoice?.invoiceNumber,
    }));
  }

  async approve(approvalId: string, user: RequestUser) {
    const approval = await this.prisma.manualPaymentApproval.findUnique({ where: { id: approvalId }, include: { payment: true } });
    if (!approval) throw new NotFoundException('Approval record not found');
    assertSchoolInScope(user, approval.payment?.schoolId ?? null);
    if (approval.decision !== null) {
      throw new BadRequestException(`Approval already ${approval.decision.toLowerCase()}`);
    }

    // The invoice may have been settled, waived or cancelled since the payment was entered.
    const liveInvoice = await this.prisma.invoice.findUnique({ where: { id: approval.payment.invoiceId } });
    if (!liveInvoice) throw new NotFoundException('Invoice not found');
    this.assertPayable(liveInvoice);
    if (approval.payment.amount.gt(liveInvoice.outstandingBalance)) {
      throw new BadRequestException(
        `This payment (${approval.payment.amount.toString()}) is more than the invoice still owes (${liveInvoice.outstandingBalance.toString()}). Reject it or correct the amount.`,
      );
    }

    await this.prisma.manualPaymentApproval.update({
      where: { id: approvalId },
      data: { decision: 'APPROVED', reviewedAt: new Date(), reviewedById: user.id },
    });

    const payment = await this.prisma.payment.update({
      where: { id: approval.paymentId },
      data: {
        status: PaymentStatus.CONFIRMED,
        approvalStatus: ApprovalStatus.APPROVED,
        confirmedAt: new Date(),
        confirmedById: user.id,
      },
    });

    await this.applyPaymentToInvoice(payment.id, user);

    await this.audit.log({
      entityType: 'ManualPaymentApproval',
      entityId: approvalId,
      action: FinancialAuditAction.MANUAL_PAYMENT_APPROVED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: payment,
    });

    await this.rabbitMq.publish('manual.payment.approved', {
      approvalId,
      paymentId: payment.id,
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      approvedById: user.id,
    });

    return { approved: true, paymentId: payment.id };
  }

  async reject(approvalId: string, rejectionReason: string, user: RequestUser) {
    const approval = await this.prisma.manualPaymentApproval.findUnique({ where: { id: approvalId }, include: { payment: true } });
    if (!approval) throw new NotFoundException('Approval record not found');
    assertSchoolInScope(user, approval.payment?.schoolId ?? null);
    if (approval.decision !== null) {
      throw new BadRequestException(`Approval already ${approval.decision.toLowerCase()}`);
    }

    await this.prisma.manualPaymentApproval.update({
      where: { id: approvalId },
      data: {
        decision: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: user.id,
        rejectionReason,
      },
    });

    const payment = await this.prisma.payment.update({
      where: { id: approval.paymentId },
      data: {
        status: PaymentStatus.REJECTED,
        approvalStatus: ApprovalStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedById: user.id,
        rejectionReason,
      },
    });

    await this.audit.log({
      entityType: 'ManualPaymentApproval',
      entityId: approvalId,
      action: FinancialAuditAction.MANUAL_PAYMENT_REJECTED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: payment,
    });

    await this.rabbitMq.publish('payment.rejected', {
      paymentId: payment.id,
      studentId: payment.studentId,
      rejectionReason,
      enteredById: approval.requestedById,
    });

    return { rejected: true, paymentId: payment.id };
  }

  async refund(paymentId: string, refundReason: string, user: RequestUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    assertSchoolInScope(user, payment.schoolId ?? null);
    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed payments can be refunded');
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paidAmount = invoice.paidAmount.minus(payment.amount);
    const outstanding = invoice.totalAmount.minus(paidAmount);
    const status = this.status(invoice.totalAmount, paidAmount, invoice.dueDate);

    await this.prisma.$transaction([
      this.prisma.receipt.updateMany({
        where: { paymentId: payment.id, isVoided: false },
        data: { isVoided: true, voidReason: `Payment refunded: ${refundReason}`, voidedById: user.id, voidedAt: new Date() },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundReason,
          refundedAt: new Date(),
          refundedById: user.id,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount,
          outstandingBalance: outstanding,
          status,
        },
      }),
    ]);

    await this.audit.log({
      entityType: 'Payment',
      entityId: payment.id,
      action: FinancialAuditAction.PAYMENT_REFUNDED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: payment,
      metadata: { refundReason },
    });

    return { refunded: true };
  }

  async addNote(paymentId: string, note: string, user: RequestUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    assertSchoolInScope(user, payment.schoolId ?? null);

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { notes: note },
    });

    await this.audit.log({
      entityType: 'Payment',
      entityId: paymentId,
      action: FinancialAuditAction.PAYMENT_NOTE_ADDED,
      performedById: user.id,
      performedByRole: user.role,
      metadata: { note },
    });

    return updated;
  }
}
