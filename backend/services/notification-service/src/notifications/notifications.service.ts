import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async list(userId: string, query: NotificationsQueryDto) {
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const items = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        channel: query.channel as any,
        eventType: query.eventType,
        isRead: query.isRead === undefined ? undefined : query.isRead === 'true',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await this.unreadCount(userId);
    return { items, unreadCount };
  }

  async markRead(id: string, userId: string) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.recipientId !== userId) throw new ForbiddenException('Forbidden');

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    await this.redis.del(`notif:unread:${userId}`);
    return updated;
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { recipientId: userId, channel: 'IN_APP', isRead: false }, data: { isRead: true, readAt: new Date() } });
    await this.redis.del(`notif:unread:${userId}`);
    return { success: true };
  }

  async unreadCount(userId: string): Promise<number> {
    const key = `notif:unread:${userId}`;
    const cached = await this.redis.get<number>(key);
    if (typeof cached === 'number') return cached;

    const count = await this.prisma.notification.count({ where: { recipientId: userId, channel: 'IN_APP', isRead: false } });
    await this.redis.set(key, count, 60);
    return count;
  }
}
