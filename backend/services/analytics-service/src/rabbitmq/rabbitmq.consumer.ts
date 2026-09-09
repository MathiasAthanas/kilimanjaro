import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportType } from '../../generated/prisma';
import * as amqp from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DownstreamService } from '../downstream/downstream.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly reportsService: ReportsService,
    private readonly downstream: DownstreamService,
  ) {}

  async onModuleInit() {
    this.connectWithRetry().catch((error) => this.logger.warn(`RabbitMQ permanently disabled: ${error.message}`));
  }

  private async connectWithRetry(attempt = 0): Promise<void> {
    try {
      await this.bootstrap();
    } catch (error: any) {
      const delay = Math.min(5000 * 2 ** attempt, 60000);
      this.logger.warn(`RabbitMQ connect failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${error.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return this.connectWithRetry(attempt + 1);
    }
  }

  private async bootstrap() {
    const url = this.config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    const conn = await amqp.connect(url);
    const channel = await conn.createChannel();

    conn.on('error', (err: Error) => this.logger.warn(`RabbitMQ connection error: ${err.message}`));
    conn.on('close', () => {
      this.logger.warn('RabbitMQ connection closed — reconnecting analytics consumer');
      this.connectWithRetry().catch((e) => this.logger.error(`Reconnect failed permanently: ${e.message}`));
    });

    await channel.prefetch(20);

    // Assert the DLQ exchange once — all analytics queues route nacked messages here.
    await channel.assertExchange('dlq.direct', 'direct', { durable: true });

    const bindings = [
      { exchange: 'student.events', queue: 'analytics-service.student' },
      { exchange: 'academic.events', queue: 'analytics-service.academic' },
      { exchange: 'finance.events', queue: 'analytics-service.finance' },
      { exchange: 'elearning.events', queue: 'analytics-service.elearning' },
    ];

    for (const binding of bindings) {
      await channel.assertExchange(binding.exchange, 'topic', { durable: true });
      await channel.assertQueue(binding.queue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlq.direct',
          'x-dead-letter-routing-key': binding.queue,
        },
      });
      await channel.assertQueue(`${binding.queue}.dlq`, { durable: true });
      await channel.bindQueue(`${binding.queue}.dlq`, 'dlq.direct', binding.queue);
      await channel.bindQueue(binding.queue, binding.exchange, '#');
      await channel.consume(binding.queue, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString() || '{}');
          const eventType = payload.eventType || msg.fields.routingKey || 'unknown';
          await this.prisma.metricEvent.create({
            data: {
              eventType,
              sourceService: binding.exchange,
              payload: payload as any,
            },
          });
          await this.handleEvent(eventType, payload);
          channel.ack(msg);
        } catch (error: any) {
          this.logger.error(`Failed to handle message from ${binding.queue}: ${error.message}`);
          channel.nack(msg, false, false);
        }
      });
    }

    this.logger.log('RabbitMQ analytics consumers registered');
  }

  private async handleEvent(eventType: string, payload: any) {
    const period = payload.period || `${new Date().getFullYear()}-${`${new Date().getMonth() + 1}`.padStart(2, '0')}`;
    const schoolId = payload.schoolId as string | undefined;

    if (eventType.includes('student.enrolled') || eventType.includes('status.changed')) {
      await this.redis.delByPattern('analytics:overview:*');
      await this.redis.delByPattern('analytics:enrolment:*');
    }

    if (eventType.includes('results.published') || eventType.includes('academic.results.finalized')) {
      await this.redis.delByPattern('analytics:academic:*');
      if (eventType.includes('results.published')) {
        await this.triggerTermEndReports(payload);
      }
    }

    if (eventType.includes('finance.payment.recorded') || eventType.includes('payment.confirmed') || eventType.includes('finance.invoice.generated')) {
      await this.redis.delByPattern('analytics:finance:*');
    }

    if (eventType.includes('performance.alert')) {
      await this.redis.delByPattern('analytics:academic:engine:*');
      if (payload.studentId) await this.redis.delByPattern(`analytics:student:${payload.studentId}:*`);
    }

    if (
      eventType.includes('assignment.published') ||
      eventType.includes('quiz.published') ||
      eventType.includes('submission.graded') ||
      eventType.includes('quiz.result') ||
      eventType.includes('assignment.overdue')
    ) {
      await this.redis.delByPattern('analytics:elearning:*');
      if (payload.studentId) await this.redis.delByPattern(`analytics:student:${payload.studentId}:*`);
    }

    const upserts = [
      { name: 'school_enrolment', when: eventType.includes('student') },
      { name: 'pass_rate', when: eventType.includes('academic') },
      { name: 'collection_rate', when: eventType.includes('finance') || eventType.includes('payment') },
      { name: 'elearning_submissions', when: eventType.includes('submission.graded') || eventType.includes('quiz.result') },
      { name: 'elearning_content_published', when: eventType.includes('assignment.published') || eventType.includes('quiz.published') },
    ];

    for (const item of upserts) {
      if (!item.when) continue;
      const scope = schoolId ? `school:${schoolId}` : 'school';
      await this.prisma.kpiHistory.upsert({
        where: { kpiName_scope_period: { kpiName: item.name, scope, period } },
        create: { kpiName: item.name, scope, period, value: Number(payload.value || 0) },
        update: { value: Number(payload.value || 0), recordedAt: new Date() },
      });
    }
  }

  private async triggerTermEndReports(payload: any) {
    const actor = { id: 'system', role: 'SYSTEM_ADMIN' } as const;
    const reportInputs = [
      { reportType: ReportType.SCHOOL_OVERVIEW, scope: 'school', academicYearId: payload.academicYearId, termId: payload.termId },
      { reportType: ReportType.FINANCE_COLLECTION, scope: 'school', academicYearId: payload.academicYearId, termId: payload.termId },
      { reportType: ReportType.PERFORMANCE_ENGINE, scope: 'school', academicYearId: payload.academicYearId, termId: payload.termId },
    ];

    for (const input of reportInputs) {
      try {
        await this.reportsService.generateReport(input as any, actor as any);
      } catch (error: any) {
        this.logger.warn(`Term-end auto report failed for ${input.reportType}: ${error.message}`);
      }
    }

    await this.notifyTermEndReportReady(payload).catch((error: any) =>
      this.logger.warn(`Term-end notification dispatch failed: ${error.message}`),
    );
  }

  private async notifyTermEndReportReady(payload: any) {
    const recipients = await this.downstream.authUsersByRole(['PRINCIPAL', 'ACADEMIC_QA']);
    const recipientIds = [...new Set(recipients.map((item) => item.id))];
    if (!recipientIds.length) {
      this.logger.warn('No PRINCIPAL/ACADEMIC_QA recipients resolved for term-end notification');
      return;
    }

    const termLabel = payload.termName || payload.termId || 'current term';
    const yearLabel = payload.academicYearName || payload.academicYearId || 'current year';
    await this.downstream.dispatchInternalNotification({
      eventType: 'analytics.term_end_reports.ready',
      sourceService: 'analytics-service',
      recipientIds,
      subject: 'Term-end analytics reports generated',
      body: `Term-end reports are ready for ${termLabel} (${yearLabel}).`,
    });
  }
}
