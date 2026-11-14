import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { formatInvoiceNumber } from '../common/helpers/number-sequence.service';

function build(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    manualPaymentApproval: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    ...overrides,
  };
  const students: any = { lookupStudents: jest.fn().mockResolvedValue(new Map()), searchStudents: jest.fn().mockResolvedValue([]) };
  const service = new PaymentsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, students) as any;
  return { service, prisma, students };
}

const approver = { id: 'u-hof', role: 'HEAD_OF_FINANCE', scope: 'GROUP', schoolIds: ['*'] } as any;

describe('invoice numbers', () => {
  it('are INV + two-digit year + five digits, ten characters, and grow instead of repeating', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('INV2600001');
    expect(formatInvoiceNumber(2026, 83)).toBe('INV2600083');
    expect(formatInvoiceNumber(2027, 99999)).toBe('INV2799999');
    expect(formatInvoiceNumber(2026, 99999)).toHaveLength(10);
    expect(formatInvoiceNumber(2026, 100000)).toBe('INV26100000');
  });
});

describe('payment approval queue', () => {
  it('still returns a plain list when no paging is asked for', async () => {
    const { service, prisma } = build();
    const result = await service.pendingApprovals(approver, {});
    expect(Array.isArray(result)).toBe(true);
    expect(prisma.manualPaymentApproval.findMany.mock.calls[0][0].skip).toBeUndefined();
  });

  it('pages, caps the page size at 200 and sorts by amount only through the allowlist', async () => {
    const { service, prisma } = build();
    prisma.manualPaymentApproval.count.mockResolvedValue(130);
    const result = await service.pendingApprovals(approver, { paged: '1', page: '3', limit: '9999', sortBy: 'amount', sortDir: 'desc' });
    const args = prisma.manualPaymentApproval.findMany.mock.calls[0][0];
    expect(args.take).toBe(200);
    expect(args.skip).toBe(400);
    expect(args.orderBy[0]).toEqual({ payment: { amount: 'desc' } });
    expect(result.meta).toEqual({ page: 3, limit: 200, total: 130, totalPages: 1 });
  });

  it('ignores a sort column it does not know instead of passing it to the database', async () => {
    const { service, prisma } = build();
    await service.pendingApprovals(approver, { paged: '1', sortBy: 'passwordHash; drop table', sortDir: 'desc' });
    expect(prisma.manualPaymentApproval.findMany.mock.calls[0][0].orderBy).toEqual([{ requestedAt: 'desc' }]);
  });

  it('searches student, invoice, reference and payer', async () => {
    const { service, prisma, students } = build();
    students.searchStudents.mockResolvedValue(['s1']);
    await service.pendingApprovals(approver, { paged: '1', search: 'INV2600' });
    const or = prisma.manualPaymentApproval.findMany.mock.calls[0][0].where.payment.OR;
    expect(or).toEqual(expect.arrayContaining([{ invoice: { invoiceNumber: { contains: 'INV2600', mode: 'insensitive' } } }, { studentId: { in: ['s1'] } }]));
  });
});

describe('deciding payments', () => {
  it('will not let someone approve or reject a payment they entered themselves', async () => {
    const { service, prisma } = build();
    prisma.manualPaymentApproval.findUnique.mockResolvedValue({ id: 'a1', decision: null, requestedById: approver.id, payment: { schoolId: null, invoiceId: 'i1' } });
    await expect(service.approve('a1', approver)).rejects.toThrow(ForbiddenException);
    await expect(service.reject('a1', 'reason long enough', approver)).rejects.toThrow(ForbiddenException);
  });

  it('decides many at once, reports each failure and keeps going', async () => {
    const { service } = build();
    service.approve = jest.fn(async (id: string, _u?: unknown, _n?: unknown) => { if (id === 'bad') throw new BadRequestException('Invoice is settled'); return { approved: true }; });
    const result = await service.decideMany({ decision: 'APPROVE', approvalIds: ['a', 'bad', 'c', 'a'] }, approver);
    expect(result).toMatchObject({ requested: 3, succeeded: 2, done: ['a', 'c'] });
    expect(result.failed).toEqual([{ approvalId: 'bad', message: 'Invoice is settled' }]);
  });

  it('needs a real reason to reject in bulk, a non-empty list and at most 200', async () => {
    const { service } = build();
    await expect(service.decideMany({ decision: 'REJECT', approvalIds: ['a'], reason: 'no' }, approver)).rejects.toThrow(/at least 8/);
    await expect(service.decideMany({ decision: 'APPROVE', approvalIds: [] }, approver)).rejects.toThrow(/at least one/);
    await expect(service.decideMany({ decision: 'APPROVE', approvalIds: Array.from({ length: 201 }, (_, i) => `a${i}`) }, approver)).rejects.toThrow(/at most 200/);
    await expect(service.decideMany({ decision: 'MAYBE' as any, approvalIds: ['a'] }, approver)).rejects.toThrow(/APPROVE or REJECT/);
  });

  it('rejects in bulk with the shared reason', async () => {
    const { service } = build();
    service.reject = jest.fn().mockResolvedValue({ rejected: true });
    await service.decideMany({ decision: 'REJECT', approvalIds: ['a', 'b'], reason: 'Wrong reference number' }, approver);
    expect(service.reject).toHaveBeenCalledWith('a', 'Wrong reference number', approver);
    expect(service.reject).toHaveBeenCalledWith('b', 'Wrong reference number', approver);
  });
});
