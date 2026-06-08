import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  AdjustStockDto,
  CreateStoreItemDto,
  IssueStockDto,
  ReceiveStockDto,
  UpdateStoreItemDto,
} from './dto/store.dto';

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
  ) {}

  private dec(v?: string, fallback = '0'): Prisma.Decimal {
    return new Prisma.Decimal(v ?? fallback);
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  async createItem(dto: CreateStoreItemDto, user: RequestUser) {
    const opening = this.dec(dto.openingQuantity);
    const unitCost = this.dec(dto.unitCost);

    const item = await this.prisma.storeItem.create({
      data: {
        itemCode: await this.numberService.storeItemCode(),
        name: dto.name,
        category: dto.category as any,
        unit: dto.unit || 'unit',
        description: dto.description,
        reorderLevel: this.dec(dto.reorderLevel),
        unitCost,
        quantityOnHand: opening,
        location: dto.location,
        createdById: user.id,
      },
    });

    if (opening.greaterThan(0)) {
      await this.prisma.storeMovement.create({
        data: {
          movementNumber: await this.numberService.storeMovementNumber(),
          storeItemId: item.id,
          type: 'RECEIPT',
          quantity: opening,
          unitCost,
          totalValue: opening.mul(unitCost),
          balanceAfter: opening,
          reason: 'Opening balance',
          recordedById: user.id,
          recordedByRole: user.role,
        },
      });
    }

    await this.auditLog(item.id, FinancialAuditAction.STORE_ITEM_CREATED, user, undefined, item);
    return item;
  }

  async listItems(filters: { category?: string; search?: string; active?: string; lowStock?: string }) {
    const where: Prisma.StoreItemWhereInput = {
      category: filters.category as any,
      isActive: filters.active === undefined ? undefined : filters.active !== 'false',
      name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    };

    const items = await this.prisma.storeItem.findMany({ where, orderBy: { name: 'asc' } });
    const rows = items.map((i) => ({
      ...i,
      lowStock: new Prisma.Decimal(i.quantityOnHand).lessThanOrEqualTo(i.reorderLevel),
      stockValue: new Prisma.Decimal(i.quantityOnHand).mul(i.unitCost),
    }));
    return filters.lowStock === 'true' ? rows.filter((r) => r.lowStock) : rows;
  }

  async itemById(id: string) {
    const item = await this.prisma.storeItem.findUnique({
      where: { id },
      include: { movements: { orderBy: { occurredAt: 'desc' }, take: 50 } },
    });
    if (!item) throw new NotFoundException('Store item not found');
    return item;
  }

  async updateItem(id: string, dto: UpdateStoreItemDto, user: RequestUser) {
    const existing = await this.prisma.storeItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Store item not found');

    const item = await this.prisma.storeItem.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category as any,
        unit: dto.unit,
        description: dto.description,
        reorderLevel: dto.reorderLevel !== undefined ? this.dec(dto.reorderLevel) : undefined,
        unitCost: dto.unitCost !== undefined ? this.dec(dto.unitCost) : undefined,
        location: dto.location,
        isActive: dto.isActive,
        updatedById: user.id,
      },
    });
    await this.auditLog(id, FinancialAuditAction.STORE_ITEM_UPDATED, user, existing, item);
    return item;
  }

  // ── Movements ───────────────────────────────────────────────────────────────
  async receive(id: string, dto: ReceiveStockDto, user: RequestUser) {
    const item = await this.requireItem(id);
    const qty = this.dec(dto.quantity);
    if (qty.lessThanOrEqualTo(0)) throw new BadRequestException('Quantity must be greater than zero');
    const unitCost = dto.unitCost !== undefined ? this.dec(dto.unitCost) : new Prisma.Decimal(item.unitCost);
    const balanceAfter = new Prisma.Decimal(item.quantityOnHand).add(qty);

    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.storeMovement.create({
        data: {
          movementNumber: await this.numberService.storeMovementNumber(),
          storeItemId: id,
          type: 'RECEIPT',
          quantity: qty,
          unitCost,
          totalValue: qty.mul(unitCost),
          balanceAfter,
          supplier: dto.supplier,
          reference: dto.reference,
          reason: dto.reason,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          recordedById: user.id,
          recordedByName: dto.actorName,
          recordedByRole: user.role,
        },
      });
      const updated = await tx.storeItem.update({
        where: { id },
        data: { quantityOnHand: balanceAfter, unitCost, updatedById: user.id },
      });
      return { movement, updated };
    });

    await this.auditLog(id, FinancialAuditAction.STORE_STOCK_RECEIVED, user, item, result.movement);
    return result.updated;
  }

  async issue(id: string, dto: IssueStockDto, user: RequestUser) {
    const item = await this.requireItem(id);
    const qty = this.dec(dto.quantity);
    if (qty.lessThanOrEqualTo(0)) throw new BadRequestException('Quantity must be greater than zero');
    const onHand = new Prisma.Decimal(item.quantityOnHand);
    if (qty.greaterThan(onHand)) {
      throw new BadRequestException(`Insufficient stock: ${onHand} ${item.unit} on hand`);
    }
    const balanceAfter = onHand.sub(qty);
    const unitCost = new Prisma.Decimal(item.unitCost);

    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.storeMovement.create({
        data: {
          movementNumber: await this.numberService.storeMovementNumber(),
          storeItemId: id,
          type: 'ISSUE',
          quantity: qty,
          unitCost,
          totalValue: qty.mul(unitCost),
          balanceAfter,
          issuedTo: dto.issuedTo,
          department: dto.department,
          reference: dto.reference,
          reason: dto.reason,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
          recordedById: user.id,
          recordedByName: dto.actorName,
          recordedByRole: user.role,
        },
      });
      const updated = await tx.storeItem.update({
        where: { id },
        data: { quantityOnHand: balanceAfter, updatedById: user.id },
      });
      return { movement, updated };
    });

    await this.auditLog(id, FinancialAuditAction.STORE_STOCK_ISSUED, user, item, result.movement);
    return result.updated;
  }

  async adjust(id: string, dto: AdjustStockDto, user: RequestUser) {
    const item = await this.requireItem(id);
    const target = this.dec(dto.newQuantity);
    if (target.lessThan(0)) throw new BadRequestException('Quantity cannot be negative');
    const delta = target.sub(item.quantityOnHand);
    const unitCost = new Prisma.Decimal(item.unitCost);

    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.storeMovement.create({
        data: {
          movementNumber: await this.numberService.storeMovementNumber(),
          storeItemId: id,
          type: 'ADJUSTMENT',
          quantity: delta,
          unitCost,
          totalValue: delta.mul(unitCost),
          balanceAfter: target,
          reason: dto.reason,
          recordedById: user.id,
          recordedByName: dto.actorName,
          recordedByRole: user.role,
        },
      });
      const updated = await tx.storeItem.update({
        where: { id },
        data: { quantityOnHand: target, updatedById: user.id },
      });
      return { movement, updated };
    });

    await this.auditLog(id, FinancialAuditAction.STORE_STOCK_ADJUSTED, user, item, result.movement);
    return result.updated;
  }

  async movements(filters: { storeItemId?: string; type?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));
    const where: Prisma.StoreMovementWhereInput = {
      storeItemId: filters.storeItemId,
      type: filters.type as any,
      occurredAt:
        filters.startDate || filters.endDate
          ? {
              gte: filters.startDate ? new Date(filters.startDate) : undefined,
              lte: filters.endDate ? new Date(filters.endDate) : undefined,
            }
          : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.storeMovement.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { storeItem: { select: { name: true, unit: true, itemCode: true } } },
      }),
      this.prisma.storeMovement.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async summary() {
    const items = await this.prisma.storeItem.findMany({ where: { isActive: true } });
    let totalValue = new Prisma.Decimal(0);
    let lowStock = 0;
    const byCategory: Record<string, { count: number; value: Prisma.Decimal }> = {};
    for (const i of items) {
      const value = new Prisma.Decimal(i.quantityOnHand).mul(i.unitCost);
      totalValue = totalValue.add(value);
      if (new Prisma.Decimal(i.quantityOnHand).lessThanOrEqualTo(i.reorderLevel)) lowStock++;
      const cat = byCategory[i.category] ?? { count: 0, value: new Prisma.Decimal(0) };
      cat.count += 1;
      cat.value = cat.value.add(value);
      byCategory[i.category] = cat;
    }
    return {
      totalItems: items.length,
      lowStockCount: lowStock,
      totalStockValue: totalValue,
      byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, count: v.count, value: v.value })),
    };
  }

  private async requireItem(id: string) {
    const item = await this.prisma.storeItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Store item not found');
    return item;
  }

  private async auditLog(
    entityId: string,
    action: FinancialAuditAction,
    user: RequestUser,
    previousValue?: unknown,
    newValue?: unknown,
  ) {
    await this.audit.log({
      entityType: 'StoreItem',
      entityId,
      action,
      performedById: user.id,
      performedByRole: user.role,
      previousValue,
      newValue,
    });
  }
}
