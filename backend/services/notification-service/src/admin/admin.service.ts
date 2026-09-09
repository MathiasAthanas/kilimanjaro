import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  logs(query: Record<string, string>) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    return this.prisma.notification.findMany({
      where: {
        recipientId: query.recipientId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel: query.channel as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: query.status as any,
        eventType: query.eventType,
        createdAt:
          query.startDate || query.endDate
            ? {
                gte: query.startDate ? new Date(query.startDate) : undefined,
                lte: query.endDate ? new Date(query.endDate) : undefined,
              }
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async smsLogs(query: Record<string, string>) {
    const logs = await this.prisma.smsDeliveryLog.findMany({
      where: {
        provider: query.provider,
        success: query.success === undefined ? undefined : query.success === 'true',
        sentAt:
          query.startDate || query.endDate
            ? {
                gte: query.startDate ? new Date(query.startDate) : undefined,
                lte: query.endDate ? new Date(query.endDate) : undefined,
              }
            : undefined,
      },
      orderBy: { sentAt: 'desc' },
      take: 500,
    });

    const totalMessages = logs.length;
    const byProvider = logs.reduce<Record<string, number>>((acc, row) => {
      acc[row.provider] = (acc[row.provider] || 0) + 1;
      return acc;
    }, {});

    return { logs, summary: { totalMessages, byProvider } };
  }

  async stats() {
    const [totalSent, byChannelRaw, byStatusRaw, last24h] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.groupBy({ by: ['channel'], _count: { _all: true } }),
      this.prisma.notification.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.notification.groupBy({
        by: ['status'],
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        _count: { _all: true },
      }),
    ]);

    const byChannel = byChannelRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.channel] = row._count._all;
      return acc;
    }, {});

    const byStatus = byStatusRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    return {
      totalSent,
      byChannel,
      byStatus,
      deliveryRate: totalSent > 0 ? ((byStatus.DELIVERED || 0) / totalSent) * 100 : 0,
      last24Hours: {
        sent: last24h.reduce((acc, row) => acc + row._count._all, 0),
        delivered: last24h.find((x) => x.status === 'DELIVERED')?._count._all || 0,
        failed: last24h.find((x) => x.status === 'FAILED')?._count._all || 0,
      },
    };
  }
}
