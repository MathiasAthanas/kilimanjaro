import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { AccessControlService } from '../common/helpers/access-control.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly studentClient: StudentClientService,
  ) {}

  /** Directors only ever see aggregates; every other role is limited to its own schools. */
  private invoiceWhere(filters: { termId?: string; academicYearId?: string; classId?: string }, user?: RequestUser) {
    return {
      ...schoolScopeFilter(user),
      termId: filters.termId,
      academicYearId: filters.academicYearId,
      classId: filters.classId,
      // Cancelled invoices were never owed; including them would inflate "billed".
      status: { notIn: ['CANCELLED' as const] },
    };
  }

  async collectionSummary(filters: { termId?: string; academicYearId?: string; classId?: string }, user?: RequestUser) {
    const where = this.invoiceWhere(filters, user);

    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 13);
    const [invoiceAgg, paymentAgg, overdueCount, overdueAmountAgg, byClassRows, lineRows, trendRows] = await Promise.all([
      this.prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true, paidAmount: true, outstandingBalance: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { status: 'CONFIRMED', invoice: where },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.count({ where: { ...where, status: 'OVERDUE' } }),
      this.prisma.invoice.aggregate({ where: { ...where, status: 'OVERDUE' }, _sum: { outstandingBalance: true } }),
      this.prisma.invoice.groupBy({
        by: ['classId'],
        where,
        _sum: { totalAmount: true, paidAmount: true, outstandingBalance: true },
        _count: { _all: true },
      }),
      this.prisma.invoiceLineItem.groupBy({
        by: ['feeCategoryName'],
        where: { invoice: where },
        _sum: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'CONFIRMED', paidAt: { gte: trendStart }, invoice: where },
        select: { paidAt: true, amount: true },
      }),
    ]);

    const trendByDay = new Map<string, Prisma.Decimal>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(trendStart);
      d.setUTCDate(d.getUTCDate() + i);
      trendByDay.set(d.toISOString().slice(0, 10), new Prisma.Decimal(0));
    }
    for (const row of trendRows) {
      const day = row.paidAt?.toISOString().slice(0, 10);
      if (day && trendByDay.has(day)) trendByDay.set(day, trendByDay.get(day)!.plus(row.amount));
    }

    const classNames = await this.classNames(byClassRows.map((r) => r.classId));

    const totalBilled = invoiceAgg._sum.totalAmount || new Prisma.Decimal(0);
    const totalCollected = invoiceAgg._sum.paidAmount || new Prisma.Decimal(0);
    const totalOutstanding = invoiceAgg._sum.outstandingBalance || new Prisma.Decimal(0);
    const overdueAmount = overdueAmountAgg._sum.outstandingBalance || new Prisma.Decimal(0);
    const rate = (billed: Prisma.Decimal, paid: Prisma.Decimal) => (billed.gt(0) ? paid.div(billed).mul(100).toDecimalPlaces(2).toString() : '0');

    return {
      totalBilled: totalBilled.toString(),
      totalCollected: totalCollected.toString(),
      totalOutstanding: totalOutstanding.toString(),
      collectionRate: rate(totalBilled, totalCollected),
      byPaymentMethod: paymentAgg.map((row) => ({
        method: row.method,
        totalAmount: (row._sum.amount || new Prisma.Decimal(0)).toString(),
        transactionCount: row._count._all,
      })),
      overdueCount,
      overdueAmount: overdueAmount.toString(),
      dailyTrend: [...trendByDay.entries()].map(([date, amount]) => ({ date, amount: amount.toString() })),
      byClass: byClassRows
        .map((r) => {
          const billed = r._sum.totalAmount || new Prisma.Decimal(0);
          const paid = r._sum.paidAmount || new Prisma.Decimal(0);
          return {
            classId: r.classId,
            className: classNames.get(r.classId) ?? r.classId,
            invoiceCount: r._count._all,
            billed: billed.toString(),
            collected: paid.toString(),
            outstanding: (r._sum.outstandingBalance || new Prisma.Decimal(0)).toString(),
            collectionRate: rate(billed, paid),
          };
        })
        .sort((a, b) => a.className.localeCompare(b.className)),
      byFeeCategory: lineRows
        .map((r) => ({ feeCategoryName: r.feeCategoryName, billed: (r._sum.amount || new Prisma.Decimal(0)).toString() }))
        .sort((a, b) => Number(b.billed) - Number(a.billed)),
    };
  }

  private async classNames(classIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = [...new Set(classIds.filter(Boolean))];
    if (!unique.length) return map;
    const sample = await this.prisma.invoice.findMany({ where: { classId: { in: unique } }, distinct: ['classId'], select: { studentId: true, classId: true } });
    const students = await this.studentClient.lookupStudents(sample.map((s) => s.studentId));
    for (const row of sample) {
      const name = students.get(row.studentId)?.className;
      if (name) map.set(row.classId, name);
    }
    return map;
  }

  async outstandingBalances(filters: { termId?: string; academicYearId?: string; classId?: string; minAmount?: string }, user?: RequestUser) {
    const min = filters.minAmount ? new Prisma.Decimal(filters.minAmount) : new Prisma.Decimal(0);
    const rows = await this.prisma.invoice.findMany({
      where: {
        ...this.invoiceWhere(filters, user),
        outstandingBalance: { gt: min },
      },
      orderBy: { outstandingBalance: 'desc' },
    });
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.studentId));

    return rows.map((row) => ({
      studentId: row.studentId,
      studentName: names.get(row.studentId)?.name ?? '',
      registrationNumber: names.get(row.studentId)?.registrationNumber ?? '',
      className: names.get(row.studentId)?.className ?? null,
      invoiceId: row.id,
      invoiceNumber: row.invoiceNumber,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      outstanding: row.outstandingBalance,
      dueDate: row.dueDate,
      daysOverdue: Math.max(0, Math.floor((Date.now() - row.dueDate.getTime()) / (24 * 60 * 60 * 1000))),
    }));
  }

  async dailyCollections(filters: { date?: string; startDate?: string; endDate?: string }, user?: RequestUser) {
    const start = filters.date
      ? new Date(`${filters.date}T00:00:00.000Z`)
      : filters.startDate
        ? new Date(filters.startDate)
        : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const end = filters.date
      ? new Date(`${filters.date}T23:59:59.999Z`)
      : filters.endDate
        ? new Date(filters.endDate)
        : new Date(new Date().toISOString().slice(0, 10) + 'T23:59:59.999Z');

    const rows = await this.prisma.payment.findMany({
      where: {
        ...schoolScopeFilter(user),
        status: 'CONFIRMED',
        paidAt: { gte: start, lte: end },
      },
      include: { invoice: { select: { invoiceNumber: true } } },
      orderBy: { paidAt: 'desc' },
    });
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.studentId));
    return rows.map((r) => ({
      ...r,
      invoiceNumber: r.invoice?.invoiceNumber,
      studentName: names.get(r.studentId)?.name ?? '',
      registrationNumber: names.get(r.studentId)?.registrationNumber ?? '',
    }));
  }

  /** Confirmed collections per day (and per payment method) for the last `days` days, newest data included. */
  async dailySummary(days: number, user?: RequestUser) {
    const span = Math.min(366, Math.max(1, Math.floor(days)));
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (span - 1));
    const rows = await this.prisma.payment.findMany({
      where: { ...schoolScopeFilter(user), status: 'CONFIRMED', paidAt: { gte: start } },
      select: { paidAt: true, method: true, amount: true },
    });
    const byDay = new Map<string, { total: Prisma.Decimal; count: number; methods: Map<string, Prisma.Decimal> }>();
    for (const r of rows) {
      const day = r.paidAt!.toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { total: new Prisma.Decimal(0), count: 0, methods: new Map<string, Prisma.Decimal>() };
      entry.total = entry.total.plus(r.amount);
      entry.count += 1;
      entry.methods.set(r.method, (entry.methods.get(r.method) ?? new Prisma.Decimal(0)).plus(r.amount));
      byDay.set(day, entry);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e]) => ({
        date,
        totalAmount: e.total.toString(),
        transactionCount: e.count,
        byMethod: [...e.methods.entries()].map(([method, amount]) => ({ method, amount: amount.toString() })),
      }));
  }

  async studentStatement(studentId: string, filters: { academicYearId?: string }, user: RequestUser) {
    if (['MANAGING_DIRECTOR', 'BOARD_DIRECTOR'].includes(user.role)) {
      throw new ForbiddenException('Director roles can only access aggregate finance data');
    }

    if (user.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user.role === 'STUDENT') {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }

    const staff = user.role !== 'PARENT' && user.role !== 'STUDENT';
    return this.prisma.invoice.findMany({
      where: {
        studentId,
        academicYearId: filters.academicYearId,
        ...(staff ? schoolScopeFilter(user) : {}),
      },
      include: {
        payments: true,
        lineItems: true,
        receipts: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async feeDefaulters(filters: { termId?: string; academicYearId?: string; daysOverdue?: string }, user?: RequestUser) {
    const days = Number(filters.daysOverdue || 0);
    const rows = await this.prisma.invoice.findMany({
      where: {
        ...schoolScopeFilter(user),
        termId: filters.termId,
        academicYearId: filters.academicYearId,
        status: 'OVERDUE',
        dueDate: { lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
      orderBy: { outstandingBalance: 'desc' },
    });
    const names = await this.studentClient.lookupStudents(rows.map((r) => r.studentId));
    return rows.map((r) => ({
      ...r,
      studentName: names.get(r.studentId)?.name ?? '',
      registrationNumber: names.get(r.studentId)?.registrationNumber ?? '',
      className: names.get(r.studentId)?.className ?? null,
      daysOverdue: Math.max(0, Math.floor((Date.now() - r.dueDate.getTime()) / (24 * 60 * 60 * 1000))),
    }));
  }

  async dashboard(user?: RequestUser) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const scope = schoolScopeFilter(user);

    const [invoiceTotals, monthPayments, recentPayments, overdueCount, pendingApprovals] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...scope, status: { notIn: ['CANCELLED'] } },
        _sum: { totalAmount: true, paidAmount: true, outstandingBalance: true },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...scope, status: 'CONFIRMED', createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where: { ...scope, status: 'CONFIRMED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, paymentNumber: true, amount: true, method: true, createdAt: true, studentId: true },
      }),
      this.prisma.invoice.count({ where: { ...scope, status: 'OVERDUE' } }),
      this.prisma.manualPaymentApproval.count({ where: { decision: null, payment: { ...scope } } }),
    ]);

    const totalBilled = invoiceTotals._sum.totalAmount || new Prisma.Decimal(0);
    const totalCollected = invoiceTotals._sum.paidAmount || new Prisma.Decimal(0);
    const totalOutstanding = invoiceTotals._sum.outstandingBalance || new Prisma.Decimal(0);

    return {
      summary: {
        totalBilled: totalBilled.toString(),
        totalCollected: totalCollected.toString(),
        totalOutstanding: totalOutstanding.toString(),
        collectionRate: totalBilled.gt(0) ? totalCollected.div(totalBilled).mul(100).toDecimalPlaces(2).toString() : '0',
        invoiceCount: invoiceTotals._count._all,
        overdueCount,
        pendingApprovals,
      },
      thisMonth: {
        collected: (monthPayments._sum.amount || new Prisma.Decimal(0)).toString(),
        transactions: monthPayments._count._all,
      },
      recentPayments,
      generatedAt: now.toISOString(),
    };
  }
}
