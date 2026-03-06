import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertDeviceTokenDto } from './dto/device-token.dto';

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: UpsertDeviceTokenDto) {
    const row = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform,
        deviceInfo: dto.deviceInfo,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceInfo: dto.deviceInfo,
      },
    });

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, platform: dto.platform, isActive: true },
      orderBy: { lastUsedAt: 'desc' },
    });

    if (tokens.length > 5) {
      await this.prisma.deviceToken.updateMany({
        where: { id: { in: tokens.slice(5).map((t) => t.id) } },
        data: { isActive: false },
      });
    }

    return row;
  }

  deactivate(userId: string, token: string) {
    return this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }
}
