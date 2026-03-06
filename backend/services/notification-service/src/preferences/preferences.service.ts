import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdatePreferencesDto } from './dto/preferences.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async list(userId: string) {
    const key = `notif:prefs:${userId}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    await this.redis.set(key, rows, 1800);
    return rows;
  }

  async update(userId: string, dto: UpdatePreferencesDto) {
    await this.prisma.$transaction(
      dto.preferences.map((pref) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_eventType_channel: {
              userId,
              eventType: pref.eventType,
              channel: pref.channel,
            },
          },
          update: { isEnabled: pref.isEnabled },
          create: {
            userId,
            eventType: pref.eventType,
            channel: pref.channel,
            isEnabled: pref.isEnabled,
          },
        }),
      ),
    );

    await this.redis.del(`notif:prefs:${userId}`);
    return this.list(userId);
  }

  async isAllowed(userId: string, eventType: string, channel: any): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findFirst({
      where: {
        userId,
        channel,
        OR: [{ eventType }, { eventType: '*' }],
      },
      orderBy: { eventType: 'desc' },
    });

    return pref?.isEnabled ?? true;
  }
}
