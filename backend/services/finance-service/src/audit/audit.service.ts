import { Injectable } from '@nestjs/common';
import { FinancialAuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: {
    entityType: string;
    entityId: string;
    action: FinancialAuditAction;
    performedById: string;
    performedByRole: string;
    previousValue?: unknown;
    newValue?: unknown;
    metadata?: unknown;
    ipAddress?: string;
  }): Promise<void> {
    await this.prisma.financialAuditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        performedById: entry.performedById,
        performedByRole: entry.performedByRole,
        previousValue: entry.previousValue as any,
        newValue: entry.newValue as any,
        metadata: entry.metadata as any,
        ipAddress: entry.ipAddress,
      },
    });
  }

  list(filters: {
    entityType?: string;
    entityId?: string;
    action?: FinancialAuditAction;
    performedById?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    return this.prisma.financialAuditLog.findMany({
      where: {
        entityType: filters.entityType,
        entityId: filters.entityId,
        action: filters.action,
        performedById: filters.performedById,
        createdAt:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
              }
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
