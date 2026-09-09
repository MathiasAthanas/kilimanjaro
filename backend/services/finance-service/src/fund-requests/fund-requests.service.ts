import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, FundRequestStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFundRequestDto } from './dto/create-fund-request.dto';
import { schoolScopeFilter, resolveWriteSchoolId } from '../common/helpers/school-scope.helper';
import {
  ApproveFundRequestDto,
  CancelFundRequestDto,
  DisburseFundRequestDto,
  ForwardFundRequestDto,
  RejectFundRequestDto,
} from './dto/workflow.dto';

// Roles that see requests across their scope (group or school), not just their own.
const OVERSIGHT_ROLES: string[] = [
  ROLES.FINANCE,
  ROLES.HEAD_OF_FINANCE,
  ROLES.PRINCIPAL,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.MANAGER,
  ROLES.SUPER_ADMIN,
  ROLES.SYSTEM_ADMIN,
  ROLES.MANAGING_DIRECTOR,
  ROLES.BOARD_DIRECTOR,
];

@Injectable()
export class FundRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberService: NumberSequenceService,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────
  // A HOD initiates → starts at SUBMITTED (needs Head of School approval).
  // A Head of School / Manager initiates → the school step is already satisfied,
  // so it starts at SCHOOL_APPROVED and goes straight to Finance review.
  async create(dto: CreateFundRequestDto, user: RequestUser) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Amount must be greater than zero');
    const requesterName = dto.requestedByName?.trim() || user.email || user.role;

    const headRoles: string[] = [ROLES.HEAD_OF_SCHOOL, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.SUPER_ADMIN];
    const headInitiates = headRoles.includes(user.role);
    const initialStatus = headInitiates ? FundRequestStatus.SCHOOL_APPROVED : FundRequestStatus.SUBMITTED;

    const created = await this.prisma.fundRequest.create({
      data: {
        requestNumber: await this.numberService.fundRequestNumber(user.activeSchoolId ?? user.schoolIds?.find((id) => id !== '*') ?? null),
        title: dto.title,
        description: dto.description,
        category: dto.category as any,
        amount,
        department: dto.department,
        schoolId: resolveWriteSchoolId(user, (dto as any).schoolId ?? null),
        neededBy: dto.neededBy ? new Date(dto.neededBy) : undefined,
        requestedById: user.id,
        requestedByName: requesterName,
        requestedByRole: user.role,
        status: initialStatus,
        // When a head of school initiates, capture them as the school approver too.
        ...(headInitiates
          ? { principalId: user.id, principalName: requesterName, principalNote: 'Initiated by head of school', decidedAt: new Date() }
          : {}),
        events: {
          create: [
            { action: 'SUBMITTED', actorId: user.id, actorName: requesterName, actorRole: user.role, note: 'Request initiated' },
            ...(headInitiates
              ? [{ action: 'SCHOOL_APPROVED' as const, actorId: user.id, actorName: requesterName, actorRole: user.role, note: 'School approval auto-granted (initiated by head of school)' }]
              : []),
          ],
        },
      },
      include: { events: true },
    });

    await this.auditLog(created.id, FinancialAuditAction.FUND_REQUEST_SUBMITTED, user, undefined, created);
    return created;
  }

  // ── List (role-scoped) ─────────────────────────────────────────────────────
  async list(
    user: RequestUser,
    filters: { status?: string; department?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(200, Math.max(1, Number(filters.limit || 50)));

    const search = (filters.search || '').trim();
    const where: Prisma.FundRequestWhereInput = {
      status: (filters.status as FundRequestStatus) ?? undefined,
      department: filters.department,
      // Free-text search across number, title, requester and department.
      ...(search
        ? {
            OR: [
              { requestNumber: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { requestedByName: { contains: search, mode: 'insensitive' } },
              { department: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      // Group roles see everything; a Head of School sees only their school(s).
      ...schoolScopeFilter(user),
    };

    // HODs and teachers only see their own requests; oversight roles see their scope.
    if (!OVERSIGHT_ROLES.includes(user.role)) {
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

    if (!OVERSIGHT_ROLES.includes(user.role) && row.requestedById !== user.id) {
      throw new ForbiddenException('You can only view your own requests');
    }
    return row;
  }

  // ── Step 1: Head of School approves an HOD-initiated request ───────────────
  async schoolApprove(id: string, dto: ApproveFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.SUBMITTED], 'approve at school level');
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.SCHOOL_APPROVED,
        principalId: user.id,
        principalName: dto.actorName,
        principalNote: dto.note,
        decidedAt: new Date(),
        events: {
          create: {
            action: 'SCHOOL_APPROVED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.override
              ? `[Manager override] ${dto.note ?? 'Approved on behalf of Head of School'}`
              : (dto.note ?? 'Approved by Head of School'),
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_APPROVED, user, existing, row);
    return row;
  }

  // ── Step 2: Finance reviews and forwards to the Manager ────────────────────
  async financeReview(id: string, dto: ForwardFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.SCHOOL_APPROVED], 'review');
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.FINANCE_REVIEWED,
        bursarId: user.id,
        bursarName: dto.actorName,
        bursarNote: dto.note,
        forwardedAt: new Date(),
        events: {
          create: {
            action: 'FINANCE_REVIEWED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.override
              ? `[Manager override] ${dto.note ?? 'Reviewed on behalf of Finance, forwarded to Manager'}`
              : (dto.note ?? 'Reviewed by Finance, forwarded to Manager'),
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_FORWARDED, user, existing, row);
    return row;
  }

  // ── Step 3: Manager gives final approval ───────────────────────────────────
  async managerApprove(id: string, dto: ApproveFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.FINANCE_REVIEWED], 'approve');
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.MANAGER_APPROVED,
        managerId: user.id,
        managerName: dto.actorName,
        managerNote: dto.note,
        managerDecidedAt: new Date(),
        events: {
          create: {
            action: 'MANAGER_APPROVED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.note ?? 'Final approval by Manager',
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_APPROVED, user, existing, row);
    return row;
  }

  // ── Reject at any pending stage (Head of School / Finance / Manager) ───────
  async reject(id: string, dto: RejectFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(
      id,
      [FundRequestStatus.SUBMITTED, FundRequestStatus.SCHOOL_APPROVED, FundRequestStatus.FINANCE_REVIEWED],
      'reject',
    );
    const row = await this.prisma.fundRequest.update({
      where: { id },
      data: {
        status: FundRequestStatus.REJECTED,
        rejectionReason: dto.reason,
        rejectedByRole: user.role,
        decidedAt: new Date(),
        ...(user.role === ROLES.MANAGER
          ? { managerId: user.id, managerName: dto.actorName }
          : ([ROLES.HEAD_OF_SCHOOL, ROLES.PRINCIPAL] as string[]).includes(user.role)
          ? { principalId: user.id, principalName: dto.actorName }
          : { bursarId: existing.bursarId ?? user.id, bursarName: existing.bursarName ?? dto.actorName }),
        events: {
          create: {
            action: 'REJECTED',
            actorId: user.id,
            actorName: dto.actorName,
            actorRole: user.role,
            note: dto.override ? `[Manager override] ${dto.reason}` : dto.reason,
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    await this.auditLog(id, FinancialAuditAction.FUND_REQUEST_REJECTED, user, existing, row);
    return row;
  }

  // ── Finance disburses Manager-approved funds → creates an Expense atomically ─
  async disburse(id: string, dto: DisburseFundRequestDto, user: RequestUser) {
    const existing = await this.requireStatus(id, [FundRequestStatus.MANAGER_APPROVED], 'disburse');

    const result = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber: await this.numberService.expenseNumber(user.activeSchoolId ?? user.schoolIds?.find((id) => id !== '*') ?? null),
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
              note: dto.override
                ? `[Manager override] ${dto.note ?? `Disbursed via ${dto.method} on behalf of Finance`}`
                : (dto.note ?? `Disbursed via ${dto.method}`),
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
    const cancellable: FundRequestStatus[] = [
      FundRequestStatus.SUBMITTED,
      FundRequestStatus.SCHOOL_APPROVED,
      FundRequestStatus.FINANCE_REVIEWED,
    ];
    if (!cancellable.includes(existing.status as FundRequestStatus)) {
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
    const where: Prisma.FundRequestWhereInput = { ...schoolScopeFilter(user) };
    if (!OVERSIGHT_ROLES.includes(user.role)) where.requestedById = user.id;

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
      // New chain: SUBMITTED → SCHOOL_APPROVED → FINANCE_REVIEWED → MANAGER_APPROVED → DISBURSED
      pendingSchoolApproval: map[FundRequestStatus.SUBMITTED]?.count ?? 0,
      pendingFinanceReview: map[FundRequestStatus.SCHOOL_APPROVED]?.count ?? 0,
      pendingManagerApproval: map[FundRequestStatus.FINANCE_REVIEWED]?.count ?? 0,
      approvedAwaitingDisbursement: map[FundRequestStatus.MANAGER_APPROVED]?.count ?? 0,
      // legacy keys kept so older callers don't break
      pendingForward: map[FundRequestStatus.SUBMITTED]?.count ?? 0,
      pendingApproval: map[FundRequestStatus.FINANCE_REVIEWED]?.count ?? 0,
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
