import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { PrismaService } from '../prisma/prisma.service';

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

      if (['SUSPENDED', 'EXPELLED'].includes(status)) {
        await this.prisma.mark.updateMany({
          where: { studentId },
          data: {
            note: `Student ${status.toLowerCase()} - review required`,
          },
        });

        await this.prisma.termResult.updateMany({
          where: { studentId },
          data: {
            remark: `Flagged: student ${status.toLowerCase()}`,
          },
        });
      }
      return;
    }

    if (routingKey === 'student.promoted') {
      // Assessment ownership is classSubject-based; no direct mutation needed here.
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
    await channel.assertQueue('academic-service.student', { durable: true });
    await channel.bindQueue('academic-service.student', 'student.events', 'student.enrolled');
    await channel.bindQueue('academic-service.student', 'student.events', 'student.promoted');
    await channel.bindQueue('academic-service.student', 'student.events', 'student.status.changed');

    await channel.consume('academic-service.student', async (msg) => {
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
    });
  }
}
