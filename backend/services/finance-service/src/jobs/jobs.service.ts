import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 6 * * *')
  async overdueCheck() {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: new Date() },
      },
    });

    for (const invoice of invoices) {
      await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: InvoiceStatus.OVERDUE } });
      const daysOverdue = Math.floor((Date.now() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      await this.rabbitMq.publish('fee.overdue', {
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        outstandingBalance: invoice.outstandingBalance.toString(),
        daysOverdue,
      });
    }

    this.logger.log(`Overdue invoice check complete: ${invoices.length}`);
  }

  @Cron('0 7 * * *')
  async feeReminder() {
    const thresholds = (process.env.REMINDER_DAYS_BEFORE || '7,3,1').split(',').map((v) => Number(v.trim()));
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] } },
    });

    for (const invoice of invoices) {
      const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (!thresholds.includes(daysUntilDue)) continue;

      const key = `reminder-sent:${invoice.id}:${daysUntilDue}`;
      const sent = await this.redis.get(key);
      if (sent) continue;

      await this.rabbitMq.publish('fee.reminder', {
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        outstandingBalance: invoice.outstandingBalance.toString(),
        dueDate: invoice.dueDate.toISOString(),
        daysUntilDue,
      });
      await this.redis.set(key, true, 86400);
    }
  }

  @Cron('0 20 * * *')
  async dailyFinancialSummary() {
    const start = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const end = new Date(new Date().toISOString().slice(0, 10) + 'T23:59:59.999Z');

    const grouped = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'CONFIRMED', paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });

    await this.rabbitMq.publish('finance.daily.summary', {
      date: start.toISOString().slice(0, 10),
      methods: grouped,
    });
  }

  @Cron('0 8 1 * *')
  async monthlyOutstandingReport() {
    const rows = await this.prisma.invoice.findMany({
      where: { status: 'OVERDUE' },
      select: { id: true, studentId: true, outstandingBalance: true, classId: true },
    });

    await this.rabbitMq.publish('finance.monthly.outstanding', {
      month: new Date().toISOString().slice(0, 7),
      count: rows.length,
      rows,
    });
  }
}
