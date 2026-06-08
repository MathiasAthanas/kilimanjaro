import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { VoidExpenseDto } from './dto/void-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
  ) {}

  async create(dto: CreateExpenseDto, user: RequestUser) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be greater than zero');

    const row = await this.prisma.expense.create({
      data: {
        expenseNumber: await this.numberService.expenseNumber(),
        category: dto.category as any,
        description: dto.description,
        amount,
        payee: dto.payee,
        paymentMethod: dto.paymentMethod as any,
        reference: dto.reference,
        department: dto.department,
        receiptUrl: dto.receiptUrl,
        notes: dto.notes,
        incurredAt: new Date(dto.incurredAt),
        recordedById: user.id,
        recordedByName: dto.recordedByName,
        recordedByRole: user.role,
      },
    });

    await this.audit.log({
      entityType: 'Expense',
      entityId: row.id,
      action: FinancialAuditAction.EXPENSE_RECORDED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: row,
    });

    return row;
  }

  async list(filters: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));

    const where: Prisma.ExpenseWhereInput = {
      category: filters.category as any,
      status: (filters.status as any) ?? undefined,
      department: filters.department,
      incurredAt:
        filters.startDate || filters.endDate
          ? {
              gte: filters.startDate ? new Date(filters.startDate) : undefined,
              lte: filters.endDate ? new Date(filters.endDate) : undefined,
            }
          : undefined,
      description: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { incurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async byId(id: string) {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Expense not found');
    return row;
  }

  async summary(filters: { startDate?: string; endDate?: string }) {
    const where: Prisma.ExpenseWhereInput = {
      status: 'RECORDED',
      incurredAt:
        filters.startDate || filters.endDate
          ? {
              gte: filters.startDate ? new Date(filters.startDate) : undefined,
              lte: filters.endDate ? new Date(filters.endDate) : undefined,
            }
          : undefined,
    };

    const [agg, byCategory, byDepartment, count] = await Promise.all([
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
      this.prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.expense.groupBy({ by: ['department'], where, _sum: { amount: true } }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      totalSpent: agg._sum.amount ?? 0,
      count,
      byCategory: byCategory.map((c) => ({ category: c.category, total: c._sum.amount ?? 0, count: c._count._all })),
      byDepartment: byDepartment
        .filter((d) => d.department)
        .map((d) => ({ department: d.department, total: d._sum.amount ?? 0 })),
    };
  }

  async void(id: string, dto: VoidExpenseDto, user: RequestUser) {
    const existing = await this.byId(id);
    if (existing.status === 'VOIDED') throw new BadRequestException('Expense already voided');
    if (existing.fundRequestId) {
      throw new BadRequestException('Disbursement expenses cannot be voided here; reverse via the fund request');
    }

    const row = await this.prisma.expense.update({
      where: { id },
      data: { status: 'VOIDED', voidedById: user.id, voidReason: dto.reason },
    });

    await this.audit.log({
      entityType: 'Expense',
      entityId: id,
      action: FinancialAuditAction.EXPENSE_VOIDED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: row,
    });

    return row;
  }
}
