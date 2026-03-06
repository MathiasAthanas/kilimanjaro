import { Body, Controller, Get, Query, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { DispatchService } from '../dispatch/dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { ManualSendDto } from './dto/manual-send.dto';

@ApiTags('Notifications - Admin')
@Controller('notifications')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchService,
  ) {}

  @Get('logs')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  logs(@Query() query: any) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    return this.prisma.notification.findMany({
      where: {
        recipientId: query.recipientId,
        channel: query.channel,
        status: query.status,
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

  @Get('logs/sms')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.FINANCE)
  async smsLogs(@Query() query: any) {
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

    return {
      logs,
      summary: {
        totalMessages,
        byProvider,
      },
    };
  }

  @Get('stats')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
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

  @Post('send-manual')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  sendManual(@Body() dto: ManualSendDto) {
    return this.dispatch.dispatchManual(dto.recipientIds, dto.channel, dto.subject, dto.body);
  }
}
