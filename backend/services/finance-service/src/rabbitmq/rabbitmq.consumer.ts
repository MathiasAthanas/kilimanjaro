import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly prisma: PrismaService,
  ) {}

  private async handleEvent(routingKey: string, payload: any): Promise<void> {
    if (routingKey === 'student.status.changed') {
      const status = payload?.status as string | undefined;
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
  }

  async onModuleInit(): Promise<void> {
    const channel = await this.rabbitMqService.createConsumerChannel();
    if (!channel) {
      return;
    }

    await channel.assertExchange('student.events', 'topic', { durable: true });
    await channel.assertQueue('finance-service.student', { durable: true });
    await channel.bindQueue('finance-service.student', 'student.events', 'student.enrolled');
    await channel.bindQueue('finance-service.student', 'student.events', 'student.promoted');
    await channel.bindQueue('finance-service.student', 'student.events', 'student.status.changed');

    await channel.assertExchange('academic.events', 'topic', { durable: true });
    await channel.assertQueue('finance-service.academic', { durable: true });
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
