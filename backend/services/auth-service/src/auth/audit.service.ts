import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    meta: { ip?: string; ua?: string; [key: string]: any } = {},
  ) {
    const { ip, ua, ...rest } = meta;
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        ipAddress: ip,
        userAgent: ua,
        meta: Object.keys(rest).length ? rest : undefined,
      },
    });
  }
}
