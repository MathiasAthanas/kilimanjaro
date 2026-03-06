import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinancialAuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AuditService } from '../audit/audit.service';
import { CreateFeeCategoryDto } from './dto/create-fee-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpdateFeeCategoryDto } from './dto/update-fee-category.dto';

@Injectable()
export class FeeCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  private codeFromName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '')
      .toUpperCase();
  }

  async create(dto: CreateFeeCategoryDto, user: RequestUser) {
    const existing = await this.prisma.feeCategory.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('Fee category name already exists');
    }

    const code = this.codeFromName(dto.name);
    const category = await this.prisma.feeCategory.create({
      data: {
        ...dto,
        code,
        displayOrder: dto.displayOrder ?? 0,
        createdById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'FeeCategory',
      entityId: category.id,
      action: FinancialAuditAction.FEE_CATEGORY_CREATED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: category,
    });
    await this.redis.del('fee-categories:active');
    return category;
  }

  async list(filters: { isActive?: string; isOptional?: string; isBillablePerTerm?: string }) {
    const useCache = !filters.isActive && !filters.isOptional && !filters.isBillablePerTerm;
    if (useCache) {
      const cached = await this.redis.get('fee-categories:active');
      if (cached) return cached;
    }

    const rows = await this.prisma.feeCategory.findMany({
      where: {
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
        isOptional: filters.isOptional === undefined ? undefined : filters.isOptional === 'true',
        isBillablePerTerm:
          filters.isBillablePerTerm === undefined ? undefined : filters.isBillablePerTerm === 'true',
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    if (useCache) {
      await this.redis.set('fee-categories:active', rows, 1800);
    }

    return rows;
  }

  async byId(id: string) {
    const category = await this.prisma.feeCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Fee category not found');
    return category;
  }

  async update(id: string, dto: UpdateFeeCategoryDto, user: RequestUser) {
    const existing = await this.byId(id);

    if (dto.isActive === false) {
      const activeUsage = await this.prisma.invoiceLineItem.findFirst({
        where: {
          feeCategoryId: id,
          invoice: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        },
      });
      if (activeUsage) {
        throw new ConflictException('Cannot deactivate category used in active invoices');
      }
    }

    const updated = await this.prisma.feeCategory.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isOptional: dto.isOptional,
        isBillablePerTerm: dto.isBillablePerTerm,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
        updatedById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'FeeCategory',
      entityId: id,
      action:
        dto.isActive === false
          ? FinancialAuditAction.FEE_CATEGORY_DEACTIVATED
          : FinancialAuditAction.FEE_CATEGORY_UPDATED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: updated,
    });

    await this.redis.del('fee-categories:active', 'fee-matrix:*');
    return updated;
  }

  async delete(id: string) {
    const [structures, lineItems, assignments] = await Promise.all([
      this.prisma.feeStructure.count({ where: { feeCategoryId: id } }),
      this.prisma.invoiceLineItem.count({ where: { feeCategoryId: id } }),
      this.prisma.studentFeeAssignment.count({ where: { feeCategoryId: id } }),
    ]);

    if (structures > 0 || lineItems > 0 || assignments > 0) {
      throw new ConflictException('Cannot delete category with historical references');
    }

    await this.prisma.feeCategory.delete({ where: { id } });
    await this.redis.del('fee-categories:active');
    return { deleted: true };
  }

  async reorder(dto: ReorderCategoriesDto) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.feeCategory.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );

    await this.redis.del('fee-categories:active');
    return { reordered: dto.orderedIds.length };
  }
}
