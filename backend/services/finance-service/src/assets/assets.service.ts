import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, Prisma } from '../../generated/prisma';
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

  private decimal(value?: string | number | null): Prisma.Decimal | undefined {
    return value !== undefined && value !== null && String(value) !== '' ? new Prisma.Decimal(String(value)) : undefined;
  }

  private n(value: Prisma.Decimal | null | undefined): number {
    return value ? Number(value) : 0;
  }

  private async withRollup<T extends any>(row: T): Promise<T> {
    if (!row) return row;
    const asset = row as any;
    if (!asset.isGroup) {
      asset.childCount = 0;
      asset.groupPurchaseCost = this.n(asset.purchaseCost);
      asset.groupCurrentValue = this.n(asset.currentValue);
      return asset;
    }
    const children = asset.childAssets ?? await this.prisma.asset.findMany({
      where: { parentAssetId: asset.id },
      orderBy: { createdAt: 'asc' },
    });
    const activeChildren = children.filter((child: any) => child.status !== 'DISPOSED');
    const purchase = activeChildren.reduce((sum: number, child: any) => sum + this.n(child.purchaseCost), 0);
    const current = activeChildren.reduce((sum: number, child: any) => sum + this.n(child.currentValue), 0);
    asset.childAssets = children;
    asset.childCount = children.length;
    asset.groupPurchaseCost = purchase;
    asset.groupCurrentValue = current;
    asset.purchaseCost = asset.purchaseCost ?? new Prisma.Decimal(purchase);
    asset.currentValue = asset.currentValue ?? new Prisma.Decimal(current);
    return asset;
  }

  async create(dto: any, user: RequestUser) {
    const quantity = this.decimal(dto.quantity) ?? new Prisma.Decimal(1);
    const unitCost = this.decimal(dto.unitCost);
    const derivedCost = unitCost ? quantity.mul(unitCost) : undefined;
    const purchaseCost = this.decimal(dto.purchaseCost) ?? derivedCost;
    const currentValue = this.decimal(dto.currentValue) ?? purchaseCost;
    const row = await this.prisma.asset.create({
      data: {
        assetNumber: await this.numberService.assetNumber(),
        name: dto.name,
        isGroup: dto.isGroup === true || dto.isGroup === 'true',
        groupType: dto.groupType,
        parentAssetId: dto.parentAssetId,
        category: dto.category,
        type: dto.type,
        condition: dto.condition ?? 'GOOD',
        status: dto.status ?? 'ACTIVE',
        description: dto.description,
        location: dto.location,
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        assignedTo: dto.assignedTo,
        currency: dto.currency || 'TZS',
        quantity,
        unitCost: unitCost ?? (quantity.greaterThan(0) && purchaseCost ? purchaseCost.div(quantity) : undefined),
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        warrantyExpiryDate: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : undefined,
        purchaseCost,
        currentValue,
        createdById: user.id,
      },
      include: { childAssets: { orderBy: { createdAt: 'asc' } }, parentAsset: true },
    });

    await this.audit.log({
      entityType: 'Asset',
      entityId: row.id,
      action: FinancialAuditAction.ASSET_CREATED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: row,
    });

    return this.withRollup(row);
  }

  async list(filters: any) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const includeChildren = filters.includeChildren === 'true' || filters.includeChildren === true;

    const rows = await this.prisma.asset.findMany({
      where: {
        category: filters.category,
        type: filters.type,
        condition: filters.condition,
        status: filters.status,
        location: filters.location,
        isGroup: filters.isGroup === undefined ? undefined : filters.isGroup === 'true' || filters.isGroup === true,
        parentAssetId: filters.parentAssetId === undefined
          ? (filters.rootOnly === 'true' || filters.rootOnly === true ? null : undefined)
          : filters.parentAssetId,
        name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        childAssets: includeChildren ? { orderBy: { createdAt: 'asc' } } : false,
        parentAsset: true,
      },
    });
    return Promise.all(rows.map((row) => this.withRollup(row)));
  }

  async byId(id: string) {
    const row = await this.prisma.asset.findUnique({
      where: { id },
      include: { childAssets: { orderBy: { createdAt: 'asc' } }, parentAsset: true },
    });
    if (!row) throw new NotFoundException('Asset not found');
    return this.withRollup(row);
  }

  async update(id: string, dto: any, user: RequestUser) {
    const existing = await this.byId(id);
    const { warrantyExpiry, purchaseDate, purchaseCost, currentValue, quantity, unitCost, isGroup, ...rest } = dto;
    const qty = this.decimal(quantity);
    const unit = this.decimal(unitCost);
    const cost = this.decimal(purchaseCost) ?? (qty && unit ? qty.mul(unit) : undefined);
    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        ...rest,
        isGroup: isGroup === undefined ? undefined : isGroup === true || isGroup === 'true',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        warrantyExpiryDate: warrantyExpiry ? new Date(warrantyExpiry) : undefined,
        quantity: qty,
        unitCost: unit,
        purchaseCost: cost,
        currentValue: currentValue ? this.decimal(currentValue) : cost,
        updatedById: user.id,
      },
      include: { childAssets: { orderBy: { createdAt: 'asc' } }, parentAsset: true },
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

    return this.withRollup(row);
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
    const [totalAssets, groupedAssets, componentAssets, byCategory, byCondition, byType, sums, rootRows] = await Promise.all([
      this.prisma.asset.count({ where: { status: { not: 'DISPOSED' } } }),
      this.prisma.asset.count({ where: { isGroup: true, status: { not: 'DISPOSED' } } }),
      this.prisma.asset.count({ where: { parentAssetId: { not: null }, status: { not: 'DISPOSED' } } }),
      this.prisma.asset.groupBy({ by: ['category'], _count: { _all: true }, _sum: { currentValue: true }, where: { status: { not: 'DISPOSED' } } }),
      this.prisma.asset.groupBy({ by: ['condition'], _count: { _all: true }, _sum: { currentValue: true }, where: { status: { not: 'DISPOSED' } } }),
      this.prisma.asset.groupBy({ by: ['type'], _count: { _all: true }, _sum: { currentValue: true }, where: { status: { not: 'DISPOSED' } } }),
      this.prisma.asset.aggregate({ _sum: { purchaseCost: true, currentValue: true }, where: { status: { not: 'DISPOSED' }, isGroup: false } }),
      this.prisma.asset.findMany({
        where: { parentAssetId: null, status: { not: 'DISPOSED' } },
        include: { childAssets: true },
      }),
    ]);
    const groups = await Promise.all(rootRows.map((row) => this.withRollup(row)));

    return {
      totalAssets,
      groupedAssets,
      componentAssets,
      byCategory,
      byCondition,
      byType,
      totalPurchaseCost: sums._sum.purchaseCost || 0,
      totalCurrentValue: sums._sum.currentValue || 0,
      fixedAssetValue: groups.reduce((sum, row: any) => sum + (row.isGroup ? row.groupCurrentValue : this.n(row.currentValue)), 0),
      groups: groups.filter((row: any) => row.isGroup).map((row: any) => ({
        id: row.id,
        assetNumber: row.assetNumber,
        name: row.name,
        location: row.location,
        category: row.category,
        childCount: row.childCount,
        currentValue: row.groupCurrentValue,
        purchaseCost: row.groupPurchaseCost,
      })).sort((a, b) => b.currentValue - a.currentValue),
    };
  }

  async fixedAssetRegister() {
    const rows = await this.prisma.asset.findMany({
      where: { parentAssetId: null, status: { not: 'DISPOSED' } },
      orderBy: { name: 'asc' },
      include: { childAssets: { orderBy: { name: 'asc' } } },
    });
    const enriched = await Promise.all(rows.map((row) => this.withRollup(row)));
    return {
      generatedAt: new Date().toISOString(),
      totalValue: enriched.reduce((sum, row: any) => sum + (row.isGroup ? row.groupCurrentValue : this.n(row.currentValue)), 0),
      totalPurchaseCost: enriched.reduce((sum, row: any) => sum + (row.isGroup ? row.groupPurchaseCost : this.n(row.purchaseCost)), 0),
      groups: enriched.filter((row: any) => row.isGroup),
      standalone: enriched.filter((row: any) => !row.isGroup),
    };
  }
}
