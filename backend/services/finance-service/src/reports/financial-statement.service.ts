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
  receivables: {
    ageing: Array<{ bucket: string; amount: number; count: number }>;
    byStatus: Array<{ status: string; amount: number; count: number }>;
    topDebtors: Array<{ studentName: string; className: string; invoiceNumber: string; outstanding: number; daysOverdue: number }>;
    rollForward: { openingEstimate: number; newBillings: number; collections: number; closingOutstanding: number; estimatedAdjustments: number };
  };
  cashflow: { inflows: number; outflows: number; netCashflow: number; disbursements: number; inventoryIssued: number };
  inventory: {
    lowStock: Array<{ itemCode: string; name: string; category: string; quantityOnHand: number; reorderLevel: number; stockValue: number }>;
    byCategory: Array<{ category: string; value: number; items: number }>;
  };
  assetBreakdown: {
    byStatus: Array<{ status: string; value: number; count: number }>;
    byCondition: Array<{ condition: string; value: number; count: number }>;
  };
  transactions: {
    recentCollections: Array<{ date: string; reference: string; payer: string; method: string; amount: number }>;
    recentExpenses: Array<{ date: string; category: string; description: string; payee: string; amount: number }>;
    recentDisbursements: Array<{ date: string; requestNumber: string; title: string; department: string; amount: number }>;
  };
  ratios: { expenseToCollectionRate: number; receivableExposureRate: number; cashCoverage: number };
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
    return `${fmt(start)} - ${fmt(end)}`;
  }

  private granularity(type: PeriodType): 'day' | 'week' | 'month' {
    if (type === 'weekly' || type === 'monthly') return 'day';
    if (type === 'quarterly') return 'week';
    return 'month';
  }

  async build(params: StatementParams): Promise<FinancialStatement> {
    const { start, end, type, label } = this.resolveRange(params);
    const inPeriod = { gte: start, lte: end };

    const [payments, invoices, outstandingAgg, expenseRows, disbursements, storeItems, movements, assets, assetAgg, assetCount] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: { status: 'CONFIRMED', paidAt: inPeriod },
          select: { amount: true, method: true, paidAt: true, referenceNumber: true, payerName: true },
          orderBy: { paidAt: 'desc' },
        }),
        this.prisma.invoice.findMany({
          where: { issuedAt: inPeriod },
          select: {
            invoiceNumber: true,
            studentId: true,
            classId: true,
            totalAmount: true,
            paidAmount: true,
            outstandingBalance: true,
            status: true,
            dueDate: true,
          },
        }),
        this.prisma.invoice.aggregate({ _sum: { outstandingBalance: true }, where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
        this.prisma.expense.findMany({
          where: { status: 'RECORDED', incurredAt: inPeriod },
          select: { amount: true, category: true, department: true, incurredAt: true, description: true, payee: true },
          orderBy: { incurredAt: 'desc' },
        }),
        this.prisma.fundRequest.findMany({
          where: { status: 'DISBURSED', disbursedAt: inPeriod },
          select: { requestNumber: true, title: true, department: true, amount: true, disbursedAt: true },
          orderBy: { disbursedAt: 'desc' },
        }),
        this.prisma.storeItem.findMany({ where: { isActive: true }, select: { itemCode: true, name: true, category: true, quantityOnHand: true, reorderLevel: true, unitCost: true } }),
        this.prisma.storeMovement.findMany({ where: { occurredAt: inPeriod }, select: { type: true, totalValue: true } }),
        this.prisma.asset.findMany({ where: { status: { not: 'DISPOSED' } }, select: { status: true, condition: true, currentValue: true } }),
        this.prisma.asset.aggregate({ _sum: { purchaseCost: true, currentValue: true }, where: { status: { not: 'DISPOSED' } } }),
        this.prisma.asset.count({ where: { status: { not: 'DISPOSED' } } }),
      ]);

    // Collections
    const totalCollected = payments.reduce((s, p) => s + n(p.amount), 0);
    const totalInvoiced = invoices.reduce((s, i) => s + n(i.totalAmount), 0);
    const outstanding = n(outstandingAgg._sum?.outstandingBalance);
    const methodMap = new Map<string, { amount: number; count: number }>();
    payments.forEach((p) => {
      const k = p.method;
      const cur = methodMap.get(k) ?? { amount: 0, count: 0 };
      cur.amount += n(p.amount); cur.count += 1;
      methodMap.set(k, cur);
    });

    // Expenses
    const totalExpenses = expenseRows.reduce((s, e) => s + n(e.amount), 0);
    const catMap = new Map<string, { amount: number; count: number }>();
    const deptMap = new Map<string, number>();
    expenseRows.forEach((e) => {
      const c = catMap.get(e.category) ?? { amount: 0, count: 0 };
      c.amount += n(e.amount); c.count += 1; catMap.set(e.category, c);
      if (e.department) deptMap.set(e.department, (deptMap.get(e.department) ?? 0) + n(e.amount));
    });

    // Store
    const stockValue = storeItems.reduce((s, i) => s + n(i.quantityOnHand) * n(i.unitCost), 0);
    const received = movements.filter((m) => m.type === 'RECEIPT').reduce((s, m) => s + n(m.totalValue), 0);
    const issued = movements.filter((m) => m.type === 'ISSUE').reduce((s, m) => s + n(m.totalValue), 0);

    // Time series
    const series = this.buildSeries(start, end, type, payments, expenseRows);

    const receivableBase = totalCollected + outstanding;
    const collectionRate = totalInvoiced > 0
      ? Math.round((totalCollected / totalInvoiced) * 10000) / 100
      : receivableBase > 0
        ? Math.round((totalCollected / receivableBase) * 10000) / 100
        : 0;
    const now = new Date();
    const openInvoices = await this.prisma.invoice.findMany({
      where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
      select: { invoiceNumber: true, studentId: true, classId: true, outstandingBalance: true, status: true, dueDate: true },
    });
    const studentIds = [...new Set(openInvoices.map((i) => i.studentId).filter(Boolean))];
    const classIds = [...new Set(openInvoices.map((i) => i.classId).filter(Boolean))];
    let students: Array<{ id: string; firstName: string; lastName: string }> = [];
    let classes: Array<{ id: string; name: string; stream: string | null }> = [];
    if (studentIds.length) {
      students = await this.prisma.$queryRawUnsafe<Array<{ id: string; firstName: string; lastName: string }>>(
        `SELECT id, "firstName", "lastName" FROM students."Student" WHERE id = ANY($1)`,
        studentIds,
      ).catch(() => []);
    }
    if (classIds.length) {
      classes = await this.prisma.$queryRawUnsafe<Array<{ id: string; name: string; stream: string | null }>>(
        `SELECT id, name, stream FROM students."Class" WHERE id = ANY($1)`,
        classIds,
      ).catch(() => []);
    }
    const studentName = (id: string) => {
      const s = students.find((row) => row.id === id);
      return s ? `${s.firstName} ${s.lastName}` : 'Unknown student';
    };
    const className = (id: string) => {
      const c = classes.find((row) => row.id === id);
      return c ? [c.name, c.stream].filter(Boolean).join(' ') : 'Unknown class';
    };
    const daysOverdue = (due: Date) => Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
    const ageingDefs = [
      { bucket: 'Current', min: 0, max: 0 },
      { bucket: '1-7 days', min: 1, max: 7 },
      { bucket: '8-30 days', min: 8, max: 30 },
      { bucket: '31-60 days', min: 31, max: 60 },
      { bucket: '60+ days', min: 61, max: Number.MAX_SAFE_INTEGER },
    ];
    const ageing = ageingDefs.map((def) => {
      const rows = openInvoices.filter((i) => {
        const d = daysOverdue(i.dueDate);
        return d >= def.min && d <= def.max;
      });
      return { bucket: def.bucket, amount: rows.reduce((s, i) => s + n(i.outstandingBalance), 0), count: rows.length };
    });
    const statusMap = new Map<string, { amount: number; count: number }>();
    openInvoices.forEach((i) => {
      const current = statusMap.get(i.status) ?? { amount: 0, count: 0 };
      current.amount += n(i.outstandingBalance);
      current.count += 1;
      statusMap.set(i.status, current);
    });
    const byAssetStatus = new Map<string, { value: number; count: number }>();
    const byAssetCondition = new Map<string, { value: number; count: number }>();
    assets.forEach((a) => {
      const s = byAssetStatus.get(a.status) ?? { value: 0, count: 0 };
      s.value += n(a.currentValue); s.count += 1; byAssetStatus.set(a.status, s);
      const c = byAssetCondition.get(a.condition) ?? { value: 0, count: 0 };
      c.value += n(a.currentValue); c.count += 1; byAssetCondition.set(a.condition, c);
    });
    const inventoryCategoryMap = new Map<string, { value: number; items: number }>();
    storeItems.forEach((i) => {
      const cur = inventoryCategoryMap.get(i.category) ?? { value: 0, items: 0 };
      cur.value += n(i.quantityOnHand) * n(i.unitCost);
      cur.items += 1;
      inventoryCategoryMap.set(i.category, cur);
    });
    const disbursementTotal = disbursements.reduce((s, row) => s + n(row.amount), 0);
    const outflows = totalExpenses + disbursementTotal;
    const openingEstimate = Math.max(0, outstanding - totalInvoiced + totalCollected);
    const estimatedAdjustments = outstanding - openingEstimate - totalInvoiced + totalCollected;

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
        count: expenseRows.length,
        byCategory: [...catMap.entries()].map(([category, v]) => ({ category, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
        byDepartment: [...deptMap.entries()].map(([department, amount]) => ({ department, amount })).sort((a, b) => b.amount - a.amount),
      },
      disbursements: { total: disbursementTotal, count: disbursements.length },
      store: { stockValue, received, issued },
      assets: { purchaseCost: n(assetAgg._sum.purchaseCost), currentValue: n(assetAgg._sum.currentValue), count: assetCount },
      receivables: {
        ageing,
        byStatus: [...statusMap.entries()].map(([status, v]) => ({ status, ...v })).sort((a, b) => b.amount - a.amount),
        topDebtors: openInvoices
          .slice()
          .sort((a, b) => n(b.outstandingBalance) - n(a.outstandingBalance))
          .slice(0, 15)
          .map((i) => ({
            studentName: studentName(i.studentId),
            className: className(i.classId),
            invoiceNumber: i.invoiceNumber,
            outstanding: n(i.outstandingBalance),
            daysOverdue: daysOverdue(i.dueDate),
          })),
        rollForward: {
          openingEstimate,
          newBillings: totalInvoiced,
          collections: totalCollected,
          closingOutstanding: outstanding,
          estimatedAdjustments,
        },
      },
      cashflow: { inflows: totalCollected, outflows, netCashflow: totalCollected - outflows, disbursements: disbursementTotal, inventoryIssued: issued },
      inventory: {
        lowStock: storeItems
          .filter((i) => n(i.reorderLevel) > 0 && n(i.quantityOnHand) <= n(i.reorderLevel))
          .slice(0, 15)
          .map((i) => ({
            itemCode: i.itemCode,
            name: i.name,
            category: i.category,
            quantityOnHand: n(i.quantityOnHand),
            reorderLevel: n(i.reorderLevel),
            stockValue: n(i.quantityOnHand) * n(i.unitCost),
          })),
        byCategory: [...inventoryCategoryMap.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.value - a.value),
      },
      assetBreakdown: {
        byStatus: [...byAssetStatus.entries()].map(([status, v]) => ({ status, ...v })).sort((a, b) => b.value - a.value),
        byCondition: [...byAssetCondition.entries()].map(([condition, v]) => ({ condition, ...v })).sort((a, b) => b.value - a.value),
      },
      transactions: {
        recentCollections: payments.slice(0, 12).map((p) => ({
          date: p.paidAt?.toISOString() ?? '',
          reference: p.referenceNumber ?? '',
          payer: p.payerName ?? 'Payer',
          method: p.method,
          amount: n(p.amount),
        })),
        recentExpenses: expenseRows.slice(0, 12).map((e) => ({
          date: e.incurredAt.toISOString(),
          category: e.category,
          description: e.description,
          payee: e.payee ?? '',
          amount: n(e.amount),
        })),
        recentDisbursements: disbursements.slice(0, 12).map((d) => ({
          date: d.disbursedAt?.toISOString() ?? '',
          requestNumber: d.requestNumber,
          title: d.title,
          department: d.department ?? '',
          amount: n(d.amount),
        })),
      },
      ratios: {
        expenseToCollectionRate: totalCollected > 0 ? Math.round((totalExpenses / totalCollected) * 10000) / 100 : 0,
        receivableExposureRate: receivableBase > 0 ? Math.round((outstanding / receivableBase) * 10000) / 100 : 0,
        cashCoverage: outflows > 0 ? Math.round((totalCollected / outflows) * 10000) / 100 : 0,
      },
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
