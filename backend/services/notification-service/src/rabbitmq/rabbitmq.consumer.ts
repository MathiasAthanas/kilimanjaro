import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, connect } from 'amqplib';
import { DispatchService } from '../dispatch/dispatch.service';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dispatch: DispatchService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');

    try {
      const conn = await connect(url);
      const ch = await conn.createChannel();

      conn.on('error', (err: Error) => this.logger.warn(`RabbitMQ connection error: ${err.message}`));
      conn.on('close', () => this.logger.warn('RabbitMQ connection closed — notification consumer offline until restart'));

      await ch.prefetch(10);
      await ch.assertExchange('dlq.direct', 'direct', { durable: true });

      await this.setup(ch, 'auth.events', 'notification-service.auth', [
        'user.created',
        'password.reset.requested',
        'account.locked',
      ], 'auth-service');
      await this.setup(ch, 'student.events', 'notification-service.student', [
        'student.enrolled',
        'attendance.marked',
        'discipline.recorded',
        'performance.alert.created',
        'performance.alert.positive',
        'performance.pairing.suggested',
        'student.status.changed',
        'performance.weekly.digest',
      ], 'student-service');
      await this.setup(ch, 'academic.events', 'notification-service.academic', [
        'marks.approval.requested',
        'marks.approved',
        'marks.rejected',
        'results.published',
        'marks.submission.reminder',
        'marks.approval.reminder',
        'alert.escalated',
        'report_card.generated',
        'report_card.signed',
      ], 'academic-service');
      await this.setup(ch, 'finance.events', 'notification-service.finance', [
        'payment.confirmed',
        'invoice.generated',
        'fee.overdue',
        'fee.reminder',
        'manual.payment.approved',
        'payment.rejected',
        'receipt.generated',
        'finance.daily.summary',
      ], 'finance-service');
      await this.setup(ch, 'elearning.events', 'notification-service.elearning', [
        'assignment.published',
        'quiz.published',
        'submission.graded',
        'quiz.result',
        'announcement.published',
        'assignment.due_soon',
        'assignment.overdue',
      ], 'elearning-service');

      this.logger.log('RabbitMQ consumers initialized');
    } catch (error) {
      this.logger.warn(`RabbitMQ unavailable: ${(error as Error).message}`);
    }
  }

  private async setup(channel: Channel, exchange: string, queue: string, keys: string[], sourceService: string) {
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlq.direct', 'x-dead-letter-routing-key': queue },
    });
    await channel.assertQueue(`${queue}.dlq`, { durable: true });
    await channel.bindQueue(`${queue}.dlq`, 'dlq.direct', queue);

    for (const key of keys) {
      await channel.bindQueue(queue, exchange, key);
    }

    await channel.consume(queue, async (msg) => {
      if (!msg) return;

      const eventType = msg.fields.routingKey;
      try {
        const payload = JSON.parse(msg.content.toString('utf8'));
        await this.dispatch.dispatchFromEvent(eventType, payload, sourceService);
        channel.ack(msg);
      } catch (error) {
        this.logger.warn(`Failed to process ${exchange}/${eventType}: ${(error as Error).message}`);
        channel.nack(msg, false, false);
      }
    });
  }
}
