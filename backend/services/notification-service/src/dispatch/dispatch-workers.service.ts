import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { EmailService } from '../channels/email/email.service';
import { PushService } from '../channels/push/push.service';
import { SmsGatewayService } from '../channels/sms/sms-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { QUEUE_NAMES } from '../queues/queue.constants';

@Injectable()
export class DispatchWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatchWorkersService.name);
  private workers: Worker[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sms: SmsGatewayService,
    private readonly email: EmailService,
    private readonly push: PushService,
  ) {}

  private connection() {
    return {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.config.get<string>('REDIS_PORT', '6379')),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
    };
  }

  async onModuleInit() {
    const connection = this.connection();

    const smsWorker = new Worker(
      QUEUE_NAMES.SMS,
      async (job) => {
        const id = job.data.notificationId as string;
        const row = await this.prisma.notification.findUnique({ where: { id } });
        if (!row) return;

        await this.prisma.notification.update({ where: { id }, data: { status: 'SENDING', lastAttemptAt: new Date(), attemptCount: { increment: 1 } } });
        const result = await this.sms.send([row.recipientPhone || ''], row.body);
        const primary = result[0];

        await this.prisma.smsDeliveryLog.create({
          data: {
            notificationId: id,
            provider: this.config.get<string>('SMS_PROVIDER', 'africastalking'),
            phoneNumber: row.recipientPhone || '',
            messageBody: row.body,
            requestPayload: { to: row.recipientPhone },
            responsePayload: (primary || null) as any,
            success: primary?.success || false,
            externalMessageId: primary?.messageId,
            cost: primary?.cost,
            failureReason: primary?.failureReason,
            attemptNumber: row.attemptCount + 1,
          },
        });

        await this.prisma.notification.update({
          where: { id },
          data: primary?.success
            ? { status: 'DELIVERED', deliveredAt: new Date(), externalMessageId: primary.messageId }
            : { status: 'FAILED', failureReason: primary?.failureReason || 'SMS send failed' },
        });
      },
      { connection },
    );

    const emailWorker = new Worker(
      QUEUE_NAMES.EMAIL,
      async (job) => {
        const id = job.data.notificationId as string;
        const row = await this.prisma.notification.findUnique({ where: { id } });
        if (!row || !row.recipientEmail) return;

        await this.prisma.notification.update({ where: { id }, data: { status: 'SENDING', lastAttemptAt: new Date(), attemptCount: { increment: 1 } } });

        try {
          const messageId = await this.email.send(row.recipientEmail, row.subject || 'Kilimanjaro Schools', row.body, row.body);
          await this.prisma.notification.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date(), externalMessageId: messageId } });
        } catch (error) {
          await this.prisma.notification.update({ where: { id }, data: { status: 'FAILED', failureReason: (error as Error).message } });
        }
      },
      { connection },
    );

    const pushWorker = new Worker(
      QUEUE_NAMES.PUSH,
      async (job) => {
        const id = job.data.notificationId as string;
        const row = await this.prisma.notification.findUnique({ where: { id } });
        if (!row) return;

        await this.prisma.notification.update({ where: { id }, data: { status: 'SENDING', lastAttemptAt: new Date(), attemptCount: { increment: 1 } } });

        try {
          const response = await this.push.send(row.recipientId, String(job.data.title || 'Kilimanjaro Schools'), row.body, {
            eventType: row.eventType,
          });
          if (response.sent > 0) {
            await this.prisma.notification.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
          } else {
            await this.prisma.notification.update({ where: { id }, data: { status: 'FAILED', failureReason: 'No active device tokens' } });
          }
        } catch (error) {
          await this.prisma.notification.update({ where: { id }, data: { status: 'FAILED', failureReason: (error as Error).message } });
        }
      },
      { connection },
    );

    const inAppWorker = new Worker(
      QUEUE_NAMES.IN_APP,
      async (job) => {
        const id = job.data.notificationId as string;
        const row = await this.prisma.notification.findUnique({ where: { id } });
        if (!row) return;

        await this.prisma.notification.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
        await this.redis.del(`notif:unread:${row.recipientId}`);
      },
      { connection },
    );

    this.workers = [smsWorker, emailWorker, pushWorker, inAppWorker];
    this.workers.forEach((worker) => worker.on('error', (error) => this.logger.warn(`Worker error: ${error.message}`)));
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }
}
