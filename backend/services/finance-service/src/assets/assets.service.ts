import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
  ) {}

  private decimal(value?: string): Prisma.Decimal | undefined {
    return value ? new Prisma.Decimal(value) : undefined;
  }

  async create(dto: any, user: RequestUser) {
    const row = await this.prisma.asset.create({
      data: {
        assetNumber: await this.numberService.assetNumber(),
        ...dto,
        purchaseCost: this.decimal(dto.purchaseCost),
        currentValue: this.decimal(dto.currentValue),
        createdById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'Asset',
      entityId: row.id,
      action: FinancialAuditAction.ASSET_CREATED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: row,
    });

    return row;
  }

  list(filters: any) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));

    return this.prisma.asset.findMany({
      where: {
        category: filters.category,
        type: filters.type,
        condition: filters.condition,
        status: filters.status,
        location: filters.location,
        name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async byId(id: string) {
    const row = await this.prisma.asset.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Asset not found');
    return row;
  }

  async update(id: string, dto: any, user: RequestUser) {
    const existing = await this.byId(id);
    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        ...dto,
        purchaseCost: dto.purchaseCost ? this.decimal(dto.purchaseCost) : undefined,
        currentValue: dto.currentValue ? this.decimal(dto.currentValue) : undefined,
        updatedById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'Asset',
      entityId: id,
      action: FinancialAuditAction.ASSET_UPDATED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: row,
    });

    return row;
  }

  async dispose(id: string, dto: any, user: RequestUser) {
    const existing = await this.byId(id);
    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        status: 'DISPOSED',
        disposalDate: new Date(dto.disposalDate),
        disposalReason: dto.disposalReason,
        disposalValue: this.decimal(dto.disposalValue),
        updatedById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'Asset',
      entityId: id,
      action: FinancialAuditAction.ASSET_DISPOSED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: row,
    });

    return row;
  }

  async summary() {
    const [totalAssets, byCategory, byCondition, byType, sums] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.groupBy({ by: ['category'], _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['condition'], _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.asset.aggregate({ _sum: { purchaseCost: true, currentValue: true } }),
    ]);

    return {
      totalAssets,
      byCategory,
      byCondition,
      byType,
      totalPurchaseCost: sums._sum.purchaseCost || 0,
      totalCurrentValue: sums._sum.currentValue || 0,
    };
  }
}
