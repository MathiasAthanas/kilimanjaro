import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialAuditAction, InvoiceStatus, ResidenceType } from '../../generated/prisma';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async handleEvent(routingKey: string, payload: any): Promise<void> {
    if (routingKey === 'student.status.changed') {
      const status = (payload?.newStatus ?? payload?.status) as string | undefined;
      const studentId = payload?.studentId as string | undefined;
      if (!studentId || !status) {
        return;
      }

      if (['SUSPENDED', 'TRANSFERRED'].includes(status)) {
        await this.prisma.invoice.updateMany({
          where: {
            studentId,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          },
          data: {
            status: InvoiceStatus.CANCELLED,
            cancellationReason: `Auto-cancelled due to student status ${status}`,
            cancelledAt: new Date(),
          },
        });
      }
      return;
    }

    if (routingKey === 'student.residence.changed') {
      const studentId = payload?.studentId as string | undefined;
      const residenceType = payload?.residenceType as ResidenceType | undefined;
      if (!studentId || !Object.values(ResidenceType).includes(residenceType!)) return;
      const affected = await this.prisma.invoice.findMany({
        where: {
          studentId,
          status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        },
        select: { id: true, schoolId: true, residenceType: true },
      });
      const reason = `Residence changed from ${payload?.previousResidenceType || 'UNCLASSIFIED'} to ${residenceType}; fee review required`;
      await this.prisma.invoice.updateMany({
        where: { id: { in: affected.map((invoice) => invoice.id) } },
        data: { feeReviewRequired: true, feeReviewReason: reason, feeReviewMarkedAt: new Date() },
      });
      for (const invoice of affected) {
        await this.audit.log({
          entityType: 'Invoice',
          entityId: invoice.id,
          action: FinancialAuditAction.INVOICE_FEE_REVIEW_MARKED,
          performedById: payload?.changedBy || 'student-service',
          performedByRole: 'SYSTEM',
          previousValue: invoice,
          newValue: { ...invoice, feeReviewRequired: true, feeReviewReason: reason },
          metadata: { schoolId: invoice.schoolId, studentId, residenceType },
        });
      }
      return;
    }

    if (routingKey === 'results.published') {
      const studentIds = Array.isArray(payload?.studentIds) ? payload.studentIds : [];
      if (studentIds.length) {
        await this.prisma.invoice.updateMany({
          where: { studentId: { in: studentIds }, termId: payload.termId },
          data: { academicCleared: true },
        });
      }
      return;
    }

    if (routingKey === 'student.enrolled') {
      // Enrollment data is sourced live from student-service internal APIs.
      return;
    }

    if (routingKey === 'student.promoted') {
      const studentId = payload?.studentId as string | undefined;
      const newClassId = payload?.newClassId as string | undefined;
      if (!studentId) return;
      // When promoted, cancel outstanding invoices from the old class/term
      // so new invoices can be generated for the new academic level.
      const oldTermId = payload?.oldTermId as string | undefined;
      if (oldTermId) {
        await this.prisma.invoice.updateMany({
          where: {
            studentId,
            termId: oldTermId,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          },
          data: {
            status: InvoiceStatus.CANCELLED,
            cancellationReason: `Auto-cancelled: student promoted${newClassId ? ` to class ${newClassId}` : ''}`,
            cancelledAt: new Date(),
          },
        });
      }
      return;
    }
  }

  async onModuleInit(): Promise<void> {
    const channel = await this.rabbitMqService.createConsumerChannel();
    if (!channel) {
      return;
    }

    await channel.assertExchange('dlq.direct', 'direct', { durable: true });
    await channel.prefetch(10);

    await channel.assertExchange('student.events', 'topic', { durable: true });
    await channel.assertQueue('finance-service.student', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlq.direct', 'x-dead-letter-routing-key': 'finance-service.student' },
    });
    await channel.assertQueue('finance-service.student.dlq', { durable: true });
    await channel.bindQueue('finance-service.student.dlq', 'dlq.direct', 'finance-service.student');
    await channel.bindQueue('finance-service.student', 'student.events', 'student.enrolled');
    await channel.bindQueue('finance-service.student', 'student.events', 'student.promoted');
    await channel.bindQueue('finance-service.student', 'student.events', 'student.status.changed');
    await channel.bindQueue('finance-service.student', 'student.events', 'student.residence.changed');

    await channel.assertExchange('academic.events', 'topic', { durable: true });
    await channel.assertQueue('finance-service.academic', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlq.direct', 'x-dead-letter-routing-key': 'finance-service.academic' },
    });
    await channel.assertQueue('finance-service.academic.dlq', { durable: true });
    await channel.bindQueue('finance-service.academic.dlq', 'dlq.direct', 'finance-service.academic');
    await channel.bindQueue('finance-service.academic', 'academic.events', 'results.published');

    const consume = async (msg: any) => {
      if (!msg) {
        return;
      }

      try {
        const payload = JSON.parse(msg.content.toString());
        this.logger.log(`Consumed ${msg.fields.routingKey}: ${JSON.stringify(payload)}`);
        await this.handleEvent(msg.fields.routingKey, payload);
        channel.ack(msg);
      } catch (error) {
        this.logger.warn(`Failed to process student event: ${(error as Error).message}`);
        channel.nack(msg, false, false);
      }
    };

    await channel.consume('finance-service.student', consume);
    await channel.consume('finance-service.academic', consume);
  }
}
