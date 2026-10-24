import { Injectable } from '@nestjs/common';
import { FinancialAuditAction } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter } from '../common/helpers/school-scope.helper';

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
    // The audit row belongs to the school of the record it describes.
    const schoolOf = (v: unknown): string | null => {
      const id = (v as { schoolId?: unknown } | null | undefined)?.schoolId;
      return typeof id === 'string' && id ? id : null;
    };
    await this.prisma.financialAuditLog.create({
      data: {
        schoolId: schoolOf(entry.newValue) ?? schoolOf(entry.previousValue) ?? schoolOf(entry.metadata),
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

  list(user: RequestUser | undefined, filters: {
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
        ...schoolScopeFilter(user),
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
