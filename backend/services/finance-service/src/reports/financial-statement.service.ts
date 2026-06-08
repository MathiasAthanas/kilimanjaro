import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface StatementParams {
  start?: string;
  end?: string;
  period?: PeriodType;
}

export interface FinancialStatement {
  period: { type: PeriodType; start: string; end: string; label: string };
  generatedAt: string;
  collections: {
    totalInvoiced: number;
    totalCollected: number;
    outstanding: number;
    collectionRate: number;
    byMethod: Array<{ method: string; amount: number; count: number }>;
  };
  expenses: {
    total: number;
    count: number;
    byCategory: Array<{ category: string; amount: number; count: number }>;
    byDepartment: Array<{ department: string; amount: number }>;
  };
  disbursements: { total: number; count: number };
  store: { stockValue: number; received: number; issued: number };
  assets: { purchaseCost: number; currentValue: number; count: number };
  net: { operatingResult: number; collectedLessExpenses: number };
  series: Array<{ label: string; collected: number; expenses: number }>;
}

const n = (d: Prisma.Decimal | null | undefined) => (d ? Number(d) : 0);

@Injectable()
export class FinancialStatementService {
  constructor(private readonly prisma: PrismaService) {}

  // Resolve start/end from explicit dates or a named period anchored on "now".
  private resolveRange(params: StatementParams): { start: Date; end: Date; type: PeriodType; label: string } {
    const now = new Date();
    const type = (params.period ?? 'monthly') as PeriodType;
    if (params.start && params.end) {
      const start = new Date(params.start);
      const end = new Date(params.end);
      return { start, end, type: params.period ?? 'custom', label: this.label(start, end, params.period ?? 'custom') };
    }
    let start = new Date(now);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    switch (type) {
      case 'weekly': start.setDate(now.getDate() - 6); break;
      case 'quarterly': start.setMonth(now.getMonth() - 2); start.setDate(1); break;
      case 'yearly': start = new Date(now.getFullYear(), 0, 1); break;
      case 'monthly':
      default: start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    }
    start.setHours(0, 0, 0, 0);
    return { start, end, type, label: this.label(start, end, type) };
  }

  private label(start: Date, end: Date, type: PeriodType): string {
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (type === 'yearly') return `Year ${start.getFullYear()}`;
    if (type === 'monthly') return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  private granularity(type: PeriodType): 'day' | 'week' | 'month' {
    if (type === 'weekly' || type === 'monthly') return 'day';
    if (type === 'quarterly') return 'week';
    return 'month';
  }

  async build(params: StatementParams): Promise<FinancialStatement> {
    const { start, end, type, label } = this.resolveRange(params);
    const inPeriod = { gte: start, lte: end };

    const [payments, invoices, outstandingAgg, expenses, disbursements, storeItems, movements, assetAgg, assetCount] =
      await Promise.all([
        this.prisma.payment.findMany({ where: { status: 'CONFIRMED', paidAt: inPeriod }, select: { amount: true, method: true, paidAt: true } }),
        this.prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { issuedAt: inPeriod } }),
        this.prisma.invoice.aggregate({ _sum: { outstandingBalance: true }, where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
        this.prisma.expense.findMany({ where: { status: 'RECORDED', incurredAt: inPeriod }, select: { amount: true, category: true, department: true, incurredAt: true } }),
        this.prisma.fundRequest.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: 'DISBURSED', disbursedAt: inPeriod } }),
        this.prisma.storeItem.findMany({ where: { isActive: true }, select: { quantityOnHand: true, unitCost: true } }),
        this.prisma.storeMovement.findMany({ where: { occurredAt: inPeriod }, select: { type: true, totalValue: true } }),
        this.prisma.asset.aggregate({ _sum: { purchaseCost: true, currentValue: true }, where: { status: { not: 'DISPOSED' } } }),
        this.prisma.asset.count({ where: { status: { not: 'DISPOSED' } } }),
      ]);

    // Collections
    const totalCollected = payments.reduce((s, p) => s + n(p.amount), 0);
    const totalInvoiced = n(invoices._sum?.totalAmount);
    const outstanding = n(outstandingAgg._sum?.outstandingBalance);
    const methodMap = new Map<string, { amount: number; count: number }>();
    payments.forEach((p) => {
      const k = p.method;
      const cur = methodMap.get(k) ?? { amount: 0, count: 0 };
      cur.amount += n(p.amount); cur.count += 1;
      methodMap.set(k, cur);
    });

    // Expenses
    const totalExpenses = expenses.reduce((s, e) => s + n(e.amount), 0);
    const catMap = new Map<string, { amount: number; count: number }>();
    const deptMap = new Map<string, number>();
    expenses.forEach((e) => {
      const c = catMap.get(e.category) ?? { amount: 0, count: 0 };
      c.amount += n(e.amount); c.count += 1; catMap.set(e.category, c);
      if (e.department) deptMap.set(e.department, (deptMap.get(e.department) ?? 0) + n(e.amount));
    });

    // Store
    const stockValue = storeItems.reduce((s, i) => s + n(i.quantityOnHand) * n(i.unitCost), 0);
    const received = movements.filter((m) => m.type === 'RECEIPT').reduce((s, m) => s + n(m.totalValue), 0);
    const issued = movements.filter((m) => m.type === 'ISSUE').reduce((s, m) => s + n(m.totalValue), 0);

    // Time series
    const series = this.buildSeries(start, end, type, payments, expenses);

    const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 10000) / 100 : 0;

    return {
      period: { type, start: start.toISOString(), end: end.toISOString(), label },
      generatedAt: new Date().toISOString(),
      collections: {
        totalInvoiced,
        totalCollected,
        outstanding,
        collectionRate,
        byMethod: [...methodMap.entries()].map(([method, v]) => ({ method, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
      },
      expenses: {
        total: totalExpenses,
        count: expenses.length,
        byCategory: [...catMap.entries()].map(([category, v]) => ({ category, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
        byDepartment: [...deptMap.entries()].map(([department, amount]) => ({ department, amount })).sort((a, b) => b.amount - a.amount),
      },
      disbursements: { total: n(disbursements._sum.amount), count: disbursements._count._all },
      store: { stockValue, received, issued },
      assets: { purchaseCost: n(assetAgg._sum.purchaseCost), currentValue: n(assetAgg._sum.currentValue), count: assetCount },
      net: { operatingResult: totalCollected - totalExpenses, collectedLessExpenses: totalCollected - totalExpenses },
      series,
    };
  }

  private buildSeries(
    start: Date,
    end: Date,
    type: PeriodType,
    payments: Array<{ amount: Prisma.Decimal; paidAt: Date | null }>,
    expenses: Array<{ amount: Prisma.Decimal; incurredAt: Date }>,
  ): Array<{ label: string; collected: number; expenses: number }> {
    const gran = this.granularity(type);
    const keyOf = (d: Date): string => {
      if (gran === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (gran === 'week') {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
      }
      return d.toISOString().slice(0, 10);
    };
    const labelOf = (d: Date): string => {
      if (gran === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (gran === 'week') return `W/c ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    const order: string[] = [];
    const labels = new Map<string, string>();
    const cursor = new Date(start);
    while (cursor <= end) {
      const k = keyOf(cursor);
      if (!labels.has(k)) { labels.set(k, labelOf(cursor)); order.push(k); }
      if (gran === 'month') cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + (gran === 'week' ? 7 : 1));
    }

    const collected = new Map<string, number>();
    const spent = new Map<string, number>();
    payments.forEach((p) => { if (p.paidAt) { const k = keyOf(new Date(p.paidAt)); collected.set(k, (collected.get(k) ?? 0) + n(p.amount)); } });
    expenses.forEach((e) => { const k = keyOf(new Date(e.incurredAt)); spent.set(k, (spent.get(k) ?? 0) + n(e.amount)); });

    return order.map((k) => ({ label: labels.get(k) ?? k, collected: collected.get(k) ?? 0, expenses: spent.get(k) ?? 0 }));
  }
}
