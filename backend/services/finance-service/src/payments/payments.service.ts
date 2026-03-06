import { createHmac, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
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
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ReceiptsService } from '../receipts/receipts.service';
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

    const invoice = await this.prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paidAmount = invoice.paidAmount.plus(payment.amount);
    const outstanding = invoice.totalAmount.minus(paidAmount);
    const status = this.status(invoice.totalAmount, paidAmount, invoice.dueDate);

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        outstandingBalance: outstanding,
        status,
      },
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
      termId: invoice.termId,
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
        paymentNumber: await this.numberService.paymentNumber(),
        invoiceId: invoice.id,
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

  private async createManualPayment(dto: CreateManualPaymentDto, method: PaymentMethod, user: RequestUser) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: dto.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payment = await this.prisma.payment.create({
      data: {
        paymentNumber: await this.numberService.paymentNumber(),
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount: this.decimal(dto.amount),
        method,
        status: PaymentStatus.PENDING,
        referenceNumber: dto.referenceNumber,
        payerName: dto.payerName,
        payerPhone: dto.payerPhone,
        paidAt: new Date(dto.paidAt),
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

  list(filters: any, _user: RequestUser) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    return this.prisma.payment.findMany({
      where: {
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
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  pendingApprovals(_user: RequestUser) {
    return this.prisma.manualPaymentApproval.findMany({
      where: { decision: null },
      include: { payment: true },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async approve(approvalId: string, user: RequestUser) {
    const approval = await this.prisma.manualPaymentApproval.findUnique({ where: { id: approvalId }, include: { payment: true } });
    if (!approval) throw new NotFoundException('Approval record not found');

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

    return { approved: true, paymentId: payment.id };
  }

  async reject(approvalId: string, rejectionReason: string, user: RequestUser) {
    const approval = await this.prisma.manualPaymentApproval.findUnique({ where: { id: approvalId }, include: { payment: true } });
    if (!approval) throw new NotFoundException('Approval record not found');

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
    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed payments can be refunded');
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paidAmount = invoice.paidAmount.minus(payment.amount);
    const outstanding = invoice.totalAmount.minus(paidAmount);
    const status = this.status(invoice.totalAmount, paidAmount, invoice.dueDate);

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundReason,
        refundedAt: new Date(),
        refundedById: user.id,
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount,
        outstandingBalance: outstanding,
        status,
      },
    });

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
}
