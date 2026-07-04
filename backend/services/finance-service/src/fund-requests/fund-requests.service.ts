import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, FundRequestStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFundRequestDto } from './dto/create-fund-request.dto';
import {
  ApproveFundRequestDto,
  CancelFundRequestDto,
  DisburseFundRequestDto,
  ForwardFundRequestDto,
  RejectFundRequestDto,
} from './dto/workflow.dto';

@Injectable()
export class FundRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
  ) {}

  // ── Create (requester: HOD / Principal / Finance) ──────────────────────────
  async create(dto: CreateFundRequestDto, user: RequestUser) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be greater than zero');
    const requesterName = dto.requestedByName?.trim() || user.email || user.role;

    const created = await this.prisma.fundRequest.create({
      data: {
        requestNumber: await this.numberService.fundRequestNumber(),
        title: dto.title,
        description: dto.description,
        category: dto.category as any,
        amount,
        department: dto.department,
        neededBy: dto.neededBy ? new Date(dto.neededBy) : undefined,
        requestedById: user.id,
        requestedByName: requesterName,
        requestedByRole: user.role,
        status: FundRequestStatus.SUBMITTED,
        events: {
          create: {
            action: 'SUBMITTED',
            actorId: user.id,
            actorName: requesterName,
            actorRole: user.role,
            note: 'Request submitted',
          },
        },
      },
      include: { events: true },
    });

    await this.auditLog(created.id, FinancialAuditAction.FUND_REQUEST_SUBMITTED, user, undefined, created);
    return created;
  }

  // ── List (role-scoped) ─────────────────────────────────────────────────────
  async list(user: RequestUser, filters: { status?: string; department?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));

    const where: Prisma.FundRequestWhereInput = {
      status: (filters.status as FundRequestStatus) ?? undefined,
      department: filters.department,
    };

    // HODs and teachers only see their own requests; finance/principal/admin see all.
    const scopedRoles: string[] = [
      ROLES.FINANCE,
      ROLES.PRINCIPAL,
      ROLES.SYSTEM_ADMIN,
      ROLES.MANAGING_DIRECTOR,
      ROLES.BOARD_DIRECTOR,
    ];
    if (!scopedRoles.includes(user.role)) {
      where.requestedById = user.id;
    }

    const [items, total] = await Promise.all([
      this.prisma.fundRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { events: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.fundRequest.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async byId(id: string, user: RequestUser) {
    const row = await this.prisma.fundRequest.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Fund request not found');

    const privileged: string[] = [
      ROLES.FINANCE,
      ROLES.PRINCIPAL,
      ROLES.SYSTEM_ADMIN,
      ROLES.MANAGING_DIRECTOR,
      ROLES.BOARD_DIRECTOR,
    ];
    if (!privileged.includes(user.role) && row.requestedById !== user.id) {
      throw new ForbiddenException('You can only view your own requests');
    }
    return row;
  }

  // ── Bursar forwards to Principal ───────────────────────────────────────────
  async forward(id: string, dto: ForwardFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.SUBMITTED], 'forward');
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.FORWARDED,
        bursarId: user.id,
        bursarName: dto.actorName,
        bursarNote: dto.note,
        forwardedAt: new Date(),
        events: {
          create: {
            action: 'FORWARDED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.note ?? 'Forwarded to Principal for approval',
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_FORWARDED, user, existing, row);
    return row;
  }

  // ── Principal approves ─────────────────────────────────────────────────────
  async approve(id: string, dto: ApproveFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.FORWARDED], 'approve');
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.APPROVED,
        principalId: user.id,
        principalName: dto.actorName,
        principalNote: dto.note,
        decidedAt: new Date(),
        events: {
          create: {
            action: 'APPROVED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.note ?? 'Approved by Principal',
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_APPROVED, user, existing, row);
    return row;
  }

  // ── Reject (Bursar before forwarding, or Principal after) ──────────────────
  async reject(id: string, dto: RejectFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(
      id,
      [FundRequestStatus.SUBMITTED, FundRequestStatus.FORWARDED],
      'reject',
    );
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.REJECTED,
        rejectionReason: dto.reason,
        rejectedByRole: user.role,
        decidedAt: new Date(),
        ...(user.role === ROLES.PRINCIPAL
          ? { principalId: user.id, principalName: dto.actorName }
          : { bursarId: existing.bursarId ?? user.id, bursarName: existing.bursarName ?? dto.actorName }),
        events: {
          create: {
            action: 'REJECTED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.reason,
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_REJECTED, user, existing, row);
    return row;
  }

  // ── Bursar disburses approved funds → creates an Expense atomically ────────
  async disburse(id: string, dto: DisburseFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.APPROVED], 'disburse');

    const result = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber: await this.numberService.expenseNumber(),
          category: existing.category,
          description: `Fund disbursement: ${existing.title} (${existing.requestNumber})`,
          amount: existing.amount,
          payee: existing.requestedByName ?? existing.requestedByRole,
          paymentMethod: dto.method as any,
          reference: dto.reference,
          department: existing.department,
          incurredAt: new Date(),
          recordedById: user.id,
          recordedByName: dto.actorName,
          recordedByRole: user.role,
          fundRequestId: existing.id,
          notes: dto.note,
        },
      });

      const updated = await tx.fundRequest.update({
        where: { id },
        data: {
          status: FundRequestStatus.DISBURSED,
          disbursedById: user.id,
          disbursedByName: dto.actorName,
          disbursementMethod: dto.method as any,
          disbursementRef: dto.reference,
          disbursedAt: new Date(),
          expenseId: expense.id,
          events: {
            create: {
              action: 'DISBURSED',
              actorId: user.id,
              actorName: dto.actorName,
              actorRole: user.role,
              note: dto.note ?? `Disbursed via ${dto.method}`,
            },
          },
        },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });

      return { updated, expense };
    });

    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_DISBURSED, user, existing, result.updated);
    await this.audit.log({
      entityType: 'Expense',
      entityId: result.expense.id,
      action: FinancialAuditAction.EXPENSE_RECORDED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: result.expense,
      metadata: { source: 'fund-disbursement', fundRequestId: id },
    });

    return result.updated;
  }

  // ── Requester cancels their own pending request ────────────────────────────
  async cancel(id: string, dto: CancelFundRequestDto, user: RequestUser) {
    const existing = await this.prisma.fundRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fund request not found');

    const privileged: string[] = [ROLES.FINANCE, ROLES.SYSTEM_ADMIN];
    if (existing.requestedById !== user.id && !privileged.includes(user.role)) {
      throw new ForbiddenException('Only the requester can cancel this request');
    }
    if (![FundRequestStatus.SUBMITTED, FundRequestStatus.FORWARDED].includes(existing.status as any)) {
      throw new BadRequestException(`Cannot cancel a request that is ${existing.status}`);
    }

    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.CANCELLED,
        events: {
          create: {
            action: 'CANCELLED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.reason ?? 'Cancelled by requester',
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_CANCELLED, user, existing, row);
    return row;
  }

  // ── Summary for dashboards ─────────────────────────────────────────────────
  async summary(user: RequestUser) {
    const where: Prisma.FundRequestWhereInput = {};
    const scopedRoles: string[] = [
      ROLES.FINANCE,
      ROLES.PRINCIPAL,
      ROLES.SYSTEM_ADMIN,
      ROLES.MANAGING_DIRECTOR,
      ROLES.BOARD_DIRECTOR,
    ];
    if (!scopedRoles.includes(user.role)) where.requestedById = user.id;

    const byStatus = await this.prisma.fundRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    });

    const map: Record<string, { count: number; total: number | Prisma.Decimal }> = {};
    for (const s of byStatus) map[s.status] = { count: s._count._all, total: s._sum.amount ?? 0 };

    return {
      byStatus: map,
      pendingForward: map[FundRequestStatus.SUBMITTED]?.count ?? 0,
      pendingApproval: map[FundRequestStatus.FORWARDED]?.count ?? 0,
      approvedAwaitingDisbursement: map[FundRequestStatus.APPROVED]?.count ?? 0,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async requireStatus(id: string, allowed: FundRequestStatus[], action: string) {
    const existing = await this.prisma.fundRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fund request not found');
    if (!allowed.includes(existing.status as FundRequestStatus)) {
      throw new BadRequestException(`Cannot ${action} a request that is ${existing.status}`);
    }
    return existing;
  }

  private async auditLog(
    entityId: string,
    action: FinancialAuditAction,
    user: RequestUser,
    previousValue?: unknown,
    newValue?: unknown,
  ) {
    await this.audit.log({
      entityType: 'FundRequest',
      entityId,
      action,
      performedById: user.id,
      performedByRole: user.role,
      previousValue,
      newValue,
    });
  }
}
