import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementStatus } from '@prisma/client';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { DispatchService } from '../dispatch/dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dispatch: DispatchService,
  ) {}

  async create(dto: CreateAnnouncementDto, user: RequestUser) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const immediate = !scheduledAt || scheduledAt <= new Date();

    const row = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        authorId: user.id,
        authorRole: user.role,
        targetRoles: dto.targetRoles || [],
        targetClassIds: dto.targetClassIds || [],
        channels: dto.channels,
        priority: dto.priority || 'NORMAL',
        status: immediate ? 'PUBLISHED' : 'SCHEDULED',
        scheduledAt,
        publishedAt: immediate ? new Date() : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        attachmentUrl: dto.attachmentUrl,
      },
    });

    if (immediate) {
      await this.dispatch.dispatchAnnouncement(row);
    }

    await this.redis.del('notif:announcements:*');
    return row;
  }

  list(query: any) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    return this.prisma.announcement.findMany({
      where: {
        status: query.status,
        priority: query.priority,
        authorId: query.authorId,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async activeForRole(role: string) {
    const key = `notif:announcements:${role}`;
    const cached = await this.redis.get<any[]>(key);
    if (cached) return cached;

    const now = new Date();
    const rows = await this.prisma.announcement.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [{ OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: role } }] }],
      },
      orderBy: { publishedAt: 'desc' },
    });

    await this.redis.set(key, rows, 300);
    return rows;
  }

  async update(id: string, dto: UpdateAnnouncementDto, user: RequestUser) {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Announcement not found');

    if (!['DRAFT', 'SCHEDULED'].includes(row.status) || (row.authorId !== user.id && user.role !== 'SYSTEM_ADMIN')) {
      throw new ForbiddenException('Cannot update this announcement');
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async cancel(id: string) {
    const row = await this.prisma.announcement.update({
      where: { id },
      data: { status: AnnouncementStatus.CANCELLED },
    });

    await this.redis.del('notif:announcements:*');
    return row;
  }

  async publishScheduled() {
    const rows = await this.prisma.announcement.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    });

    for (const row of rows) {
      await this.prisma.announcement.update({
        where: { id: row.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      await this.dispatch.dispatchAnnouncement({ ...row, status: 'PUBLISHED' } as any);
    }

    if (rows.length) await this.redis.del('notif:announcements:*');
    return rows.length;
  }

  async expireOld() {
    const result = await this.prisma.announcement.updateMany({
      where: { status: 'PUBLISHED', expiresAt: { lt: new Date() } },
      data: { status: 'CANCELLED' },
    });

    if (result.count) await this.redis.del('notif:announcements:*');
    return result.count;
  }
}
