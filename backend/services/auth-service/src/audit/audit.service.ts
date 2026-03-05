import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(input: {
    userId?: string;
    action: AuditAction;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      },
    });
  }
}
