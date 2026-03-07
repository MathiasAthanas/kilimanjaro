import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type DecimalLike = Prisma.Decimal;

@Injectable()
export class FinanceAnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  private async currentYearId() {
    return (await this.prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
  }

  private async currentTermId(academicYearId?: string) {
    return (await this.prisma.term.findFirst({ where: { academicYearId, isCurrent: true } }))?.id;
  }

  private sumDecimals(rows: DecimalLike[]): Prisma.Decimal {
    return rows.reduce((sum, row) => sum.plus(row), new Prisma.Decimal(0));
  }

  private async invoiceAdjustments(academicYearId?: string, termId?: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ waivedAmount: number | string | null; discountedAmount: number | string | null }>>(
        `
          SELECT
            COALESCE(SUM(COALESCE("waivedAmount", 0)), 0) AS "waivedAmount",
            COALESCE(SUM(COALESCE("discountAmount", 0)), 0) AS "discountedAmount"
          FROM finance."Invoice"
          WHERE ($1::text IS NULL OR "academicYearId" = $1)
            AND ($2::text IS NULL OR "termId" = $2)
        `,
        academicYearId ?? null,
        termId ?? null,
      );
      const row = rows[0] || { waivedAmount: 0, discountedAmount: 0 };
      return {
        waivedAmount: new Prisma.Decimal(row.waivedAmount || 0),
        discountedAmount: new Prisma.Decimal(row.discountedAmount || 0),
      };
    } catch {
      return {
        waivedAmount: new Prisma.Decimal(0),
        discountedAmount: new Prisma.Decimal(0),
      };
    }
  }

  private async feeCategoryBreakdown(invoiceIds: string[]) {
    if (!invoiceIds.length) return [];

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ categoryName: string; totalBilled: number | string; totalCollected: number | string; outstandingAmount: number | string }>
      >(
        `
          SELECT
            fc."name" AS "categoryName",
            COALESCE(SUM(ii."amount"), 0) AS "totalBilled",
            COALESCE(SUM(ii."paidAmount"), 0) AS "totalCollected",
            COALESCE(SUM(ii."outstandingAmount"), 0) AS "outstandingAmount"
          FROM finance."InvoiceItem" ii
          INNER JOIN finance."FeeCategory" fc ON fc."id" = ii."feeCategoryId"
          WHERE ii."invoiceId" = ANY($1)
          GROUP BY fc."name"
        `,
        invoiceIds,
      );

      return rows.map((row) => {
        const totalBilled = new Prisma.Decimal(row.totalBilled || 0);
        const totalCollected = new Prisma.Decimal(row.totalCollected || 0);
        return {
          categoryName: row.categoryName,
          totalBilled,
          totalCollected,
          collectionRate: totalBilled.gt(0) ? Number(totalCollected.div(totalBilled).mul(100).toFixed(2)) : 0,
          outstandingAmount: new Prisma.Decimal(row.outstandingAmount || 0),
        };
      });
    } catch {
      try {
        const categories = await this.prisma.feeCategory.findMany({ select: { name: true } });
        return categories.map((category) => ({
          categoryName: category.name,
          totalBilled: new Prisma.Decimal(0),
          totalCollected: new Prisma.Decimal(0),
          collectionRate: 0,
          outstandingAmount: new Prisma.Decimal(0),
        }));
      } catch {
        return [];
      }
    }
  }

  async getOverview(academicYearId?: string, termId?: string) {
    const yearId = academicYearId || (await this.currentYearId());
    const scopedTermId = termId || (await this.currentTermId(yearId));
    const key = `analytics:finance:overview:${yearId || 'current'}:${scopedTermId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const invoices = await this.prisma.invoice.findMany({
      where: { academicYearId: yearId || undefined, termId: scopedTermId || undefined },
      select: {
        id: true,
        studentId: true,
        classId: true,
        totalAmount: true,
        paidAmount: true,
        outstandingBalance: true,
        status: true,
        dueDate: true,
      },
    });

    const invoiceIds = invoices.map((row) => row.id);
    const [payments, classes, students, terms, adjustments, byFeeCategory] = await Promise.all([
      this.prisma.payment.findMany({ where: { invoiceId: { in: invoiceIds.length ? invoiceIds : ['__none__'] }, status: 'CONFIRMED' } }),
      this.prisma.class.findMany({ where: { id: { in: invoices.map((row) => row.classId) } }, select: { id: true, name: true, stream: true } }),
      this.prisma.student.findMany({ where: { id: { in: invoices.map((row) => row.studentId) } }, select: { id: true, firstName: true, lastName: true } }),
      this.prisma.term.findMany({ where: { academicYearId: yearId || undefined }, orderBy: { name: 'asc' } }),
      this.invoiceAdjustments(yearId, scopedTermId),
      this.feeCategoryBreakdown(invoiceIds),
    ]);

    const totalInvoiced = this.sumDecimals(invoices.map((row) => row.totalAmount));
    const totalCollected = this.sumDecimals(invoices.map((row) => row.paidAmount));
    const totalOutstanding = this.sumDecimals(invoices.map((row) => row.outstandingBalance));

    const byClass = classes.map((klass) => {
      const classInvoices = invoices.filter((row) => row.classId === klass.id);
      const classBilled = this.sumDecimals(classInvoices.map((row) => row.totalAmount));
      const classCollected = this.sumDecimals(classInvoices.map((row) => row.paidAmount));
      const overdueCount = classInvoices.filter((row) => row.status === 'OVERDUE').length;
      return {
        className: klass.name,
        stream: klass.stream,
        totalBilled: classBilled,
        totalCollected: classCollected,
        collectionRate: classBilled.gt(0) ? Number(classCollected.div(classBilled).mul(100).toFixed(2)) : 0,
        overdueCount,
      };
    });

    const paymentMethodMap = payments.reduce<Record<string, { totalAmount: Prisma.Decimal; transactionCount: number }>>((acc, row) => {
      if (!acc[row.method]) acc[row.method] = { totalAmount: new Prisma.Decimal(0), transactionCount: 0 };
      acc[row.method].totalAmount = acc[row.method].totalAmount.plus(row.amount);
      acc[row.method].transactionCount += 1;
      return acc;
    }, {});

    const byPaymentMethod = Object.entries(paymentMethodMap).map(([method, stat]) => ({
      method,
      totalAmount: stat.totalAmount,
      transactionCount: stat.transactionCount,
      averageTransactionAmount: stat.transactionCount ? stat.totalAmount.div(stat.transactionCount) : new Prisma.Decimal(0),
    }));

    const collectionTrend = await Promise.all(
      terms.slice(-6).map(async (term) => {
        const termInvoices = await this.prisma.invoice.findMany({
          where: { termId: term.id, academicYearId: yearId || undefined },
          select: { totalAmount: true, paidAmount: true },
        });
        const billed = this.sumDecimals(termInvoices.map((row) => row.totalAmount));
        const collected = this.sumDecimals(termInvoices.map((row) => row.paidAmount));
        return {
          period: term.name,
          collected,
          billed,
          rate: billed.gt(0) ? Number(collected.div(billed).mul(100).toFixed(2)) : 0,
        };
      }),
    );

    const now = new Date();
    const overdueInvoices = invoices.filter((row) => row.status === 'OVERDUE');
    const overdueBuckets = [
      { bucket: '1-7 days', min: 1, max: 7 },
      { bucket: '8-30 days', min: 8, max: 30 },
      { bucket: '31-60 days', min: 31, max: 60 },
      { bucket: '60+ days', min: 61, max: Number.MAX_SAFE_INTEGER },
    ].map((bucket) => {
      const inBucket = overdueInvoices.filter((row) => {
        const diff = Math.floor((now.getTime() - row.dueDate.getTime()) / 86400000);
        return diff >= bucket.min && diff <= bucket.max;
      });
      return {
        bucket: bucket.bucket,
        count: inBucket.length,
        amount: this.sumDecimals(inBucket.map((row) => row.outstandingBalance)),
      };
    });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthPayments = payments.filter((payment) => (payment.confirmedAt || payment.paidAt || now) >= monthStart);
    const dayMap = monthPayments.reduce<Record<string, { amount: Prisma.Decimal; transactionCount: number }>>((acc, payment) => {
      const date = (payment.confirmedAt || payment.paidAt || now).toISOString().slice(0, 10);
      if (!acc[date]) acc[date] = { amount: new Prisma.Decimal(0), transactionCount: 0 };
      acc[date].amount = acc[date].amount.plus(payment.amount);
      acc[date].transactionCount += 1;
      return acc;
    }, {});

    const dailyCollectionThisMonth = Object.entries(dayMap)
      .map(([date, stat]) => ({ date, amount: stat.amount, transactionCount: stat.transactionCount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topDefaulters = overdueInvoices
      .slice()
      .sort((a, b) => Number(b.outstandingBalance.minus(a.outstandingBalance).toString()))
      .slice(0, 10)
      .map((invoice) => {
        const student = students.find((row) => row.id === invoice.studentId);
        const klass = classes.find((row) => row.id === invoice.classId);
        return {
          studentId: invoice.studentId,
          studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
          className: klass?.name || 'Unknown',
          outstandingBalance: invoice.outstandingBalance,
          daysOverdue: Math.max(0, Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86400000)),
        };
      });

    const result = {
      billing: {
        totalInvoiced,
        totalCollected,
        totalOutstanding,
        collectionRate: totalInvoiced.gt(0) ? Number(totalCollected.div(totalInvoiced).mul(100).toFixed(2)) : 0,
        waivedAmount: adjustments.waivedAmount,
        discountedAmount: adjustments.discountedAmount,
      },
      byFeeCategory,
      byClass,
      byPaymentMethod,
      collectionTrend,
      overdueAnalysis: {
        overdueCount: overdueInvoices.length,
        overdueAmount: this.sumDecimals(overdueInvoices.map((row) => row.outstandingBalance)),
        byDaysOverdue: overdueBuckets,
      },
      dailyCollectionThisMonth,
      topDefaulters,
    };

    await this.redis.set(key, result, 900);
    return result;
  }

  async getRevenueForecast(academicYearId?: string) {
    const yearId = academicYearId || (await this.currentYearId());
    const key = `analytics:finance:forecast:${yearId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const [invoices, terms] = await Promise.all([
      this.prisma.invoice.findMany({ where: { academicYearId: yearId || undefined } }),
      this.prisma.term.findMany({ where: { academicYearId: yearId || undefined }, orderBy: { name: 'asc' } }),
    ]);

    const expectedAnnualRevenue = this.sumDecimals(invoices.map((row) => row.totalAmount));
    const collectedToDate = this.sumDecimals(invoices.map((row) => row.paidAmount));
    const outstanding = this.sumDecimals(invoices.map((row) => row.outstandingBalance));
    const projectedCollectionRate = expectedAnnualRevenue.gt(0) ? Number(collectedToDate.div(expectedAnnualRevenue).mul(100).toFixed(2)) : 0;
    const projectedFinalCollection = collectedToDate.plus(outstanding.mul(new Prisma.Decimal(0.55)));

    const termBreakdown = terms.map((term) => {
      const rows = invoices.filter((row) => row.termId === term.id);
      const expected = this.sumDecimals(rows.map((row) => row.totalAmount));
      const collected = this.sumDecimals(rows.map((row) => row.paidAmount));
      const outstandingTerm = this.sumDecimals(rows.map((row) => row.outstandingBalance));
      return {
        termName: term.name,
        expected,
        collected,
        outstanding: outstandingTerm,
        projectedFinal: collected.plus(outstandingTerm.mul(new Prisma.Decimal(0.55))),
      };
    });

    const riskAmount = this.sumDecimals(invoices.filter((row) => row.status === 'OVERDUE').map((row) => row.outstandingBalance));

    const result = {
      expectedAnnualRevenue,
      collectedToDate,
      projectedFinalCollection,
      projectedCollectionRate,
      termBreakdown,
      riskAmount,
    };

    await this.redis.set(key, result, 3600);
    return result;
  }

  async getAssetsSummary() {
    type AssetRow = {
      id: string;
      name: string;
      category: string;
      condition: string;
      assetType: string;
      status: string;
      location: string;
      purchaseCost: number;
      currentValue: number;
    };

    let assets: AssetRow[] = [];
    try {
      assets = await this.prisma.$queryRawUnsafe<AssetRow[]>(
        'SELECT id, name, category, condition, "assetType", status, location, "purchaseCost", "currentValue" FROM finance."Asset"',
      );
    } catch {
      assets = [];
    }

    const decimal = (num: number) => new Prisma.Decimal(num || 0);
    const totalPurchaseCost = this.sumDecimals(assets.map((row) => decimal(row.purchaseCost)));
    const totalCurrentValue = this.sumDecimals(assets.map((row) => decimal(row.currentValue)));

    const byCategory = Object.entries(
      assets.reduce<Record<string, { count: number; purchaseCost: Prisma.Decimal; currentValue: Prisma.Decimal }>>((acc, row) => {
        if (!acc[row.category]) acc[row.category] = { count: 0, purchaseCost: new Prisma.Decimal(0), currentValue: new Prisma.Decimal(0) };
        acc[row.category].count += 1;
        acc[row.category].purchaseCost = acc[row.category].purchaseCost.plus(row.purchaseCost || 0);
        acc[row.category].currentValue = acc[row.category].currentValue.plus(row.currentValue || 0);
        return acc;
      }, {}),
    ).map(([category, stat]) => ({ category, ...stat }));

    const byCondition = assets.reduce<Record<string, number>>((acc, row) => {
      acc[row.condition] = (acc[row.condition] || 0) + 1;
      return acc;
    }, { EXCELLENT: 0, GOOD: 0, FAIR: 0, POOR: 0, CONDEMNED: 0 });

    const byType = assets.reduce<Record<string, { count: number; value: Prisma.Decimal }>>((acc, row) => {
      if (!acc[row.assetType]) acc[row.assetType] = { count: 0, value: new Prisma.Decimal(0) };
      acc[row.assetType].count += 1;
      acc[row.assetType].value = acc[row.assetType].value.plus(row.currentValue || 0);
      return acc;
    }, { FIXED: { count: 0, value: new Prisma.Decimal(0) }, MOVABLE: { count: 0, value: new Prisma.Decimal(0) } });

    return {
      totalAssets: assets.length,
      totalPurchaseCost,
      totalCurrentValue,
      depreciationTotal: totalPurchaseCost.minus(totalCurrentValue),
      byCategory,
      byCondition,
      byType,
      assetsNeedingAttention: assets
        .filter((row) => ['POOR', 'CONDEMNED'].includes(row.condition))
        .map((row) => ({ id: row.id, name: row.name, condition: row.condition, status: row.status, location: row.location })),
    };
  }
}
