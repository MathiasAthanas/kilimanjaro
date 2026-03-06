import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { ReceiptPdfService } from './receipt-pdf.service';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
    private readonly studentClient: StudentClientService,
    private readonly rabbitMq: RabbitMqService,
    private readonly pdfService: ReceiptPdfService,
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

    const receiptNumber = await this.numberService.receiptNumber();

    const student = this.unwrap<any>(
      await this.studentClient.get(`/api/v1/students/${payment.studentId}`, {}, {
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
      lineItems: payment.invoice.lineItems.map((item) => ({ feeCategoryName: item.feeCategoryName, amount: item.amount.toString() })),
      previousBalance: payment.invoice.totalAmount.toString(),
      amountPaid: payment.amount.toString(),
      remainingBalance: payment.invoice.outstandingBalance.toString(),
      issuedByName: actor.id,
      issuedAt: new Date(),
    });

    const receipt = await this.prisma.receipt.create({
      data: {
        receiptNumber,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        studentId: payment.studentId,
        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || payment.studentId,
        classId: payment.invoice.classId,
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

  list(filters: any) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    return this.prisma.receipt.findMany({
      where: {
        studentId: filters.studentId,
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
    });
  }

  async byId(id: string) {
    const row = await this.prisma.receipt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Receipt not found');
    return row;
  }

  async void(id: string, voidReason: string, user: RequestUser) {
    const existing = await this.byId(id);
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
