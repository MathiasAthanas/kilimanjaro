import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async collectionSummary(filters: { termId?: string; academicYearId?: string; classId?: string }) {
    const where = {
      termId: filters.termId,
      academicYearId: filters.academicYearId,
      classId: filters.classId,
    };

    const [invoiceAgg, paymentAgg, overdueCount, overdueAmountAgg] = await Promise.all([
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
    ]);

    const totalBilled = invoiceAgg._sum.totalAmount || 0;
    const totalCollected = invoiceAgg._sum.paidAmount || 0;
    const totalOutstanding = invoiceAgg._sum.outstandingBalance || 0;

    return {
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate: Number(totalBilled) > 0 ? (Number(totalCollected) / Number(totalBilled)) * 100 : 0,
      byPaymentMethod: paymentAgg.map((row) => ({
        method: row.method,
        totalAmount: row._sum.amount || 0,
        transactionCount: row._count._all,
      })),
      overdueCount,
      overdueAmount: overdueAmountAgg._sum.outstandingBalance || 0,
      byClass: [],
      byFeeCategory: [],
    };
  }

  async outstandingBalances(filters: { termId?: string; academicYearId?: string; classId?: string; minAmount?: string }) {
    const min = filters.minAmount ? Number(filters.minAmount) : 0;
    const rows = await this.prisma.invoice.findMany({
      where: {
        termId: filters.termId,
        academicYearId: filters.academicYearId,
        classId: filters.classId,
        outstandingBalance: { gt: min },
      },
      orderBy: { outstandingBalance: 'desc' },
      include: { payments: true },
    });

    return rows.map((row) => ({
      studentId: row.studentId,
      invoiceNumber: row.invoiceNumber,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      outstanding: row.outstandingBalance,
      dueDate: row.dueDate,
      daysOverdue: Math.max(0, Math.floor((Date.now() - row.dueDate.getTime()) / (24 * 60 * 60 * 1000))),
    }));
  }

  dailyCollections(filters: { date?: string; startDate?: string; endDate?: string }) {
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

    return this.prisma.payment.findMany({
      where: {
        status: 'CONFIRMED',
        paidAt: { gte: start, lte: end },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  studentStatement(studentId: string, filters: { academicYearId?: string }) {
    return this.prisma.invoice.findMany({
      where: {
        studentId,
        academicYearId: filters.academicYearId,
      },
      include: {
        payments: true,
        lineItems: true,
        receipts: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  feeDefaulters(filters: { termId?: string; academicYearId?: string; daysOverdue?: string }) {
    const days = Number(filters.daysOverdue || 0);
    return this.prisma.invoice.findMany({
      where: {
        termId: filters.termId,
        academicYearId: filters.academicYearId,
        status: 'OVERDUE',
        dueDate: { lte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
      orderBy: { outstandingBalance: 'desc' },
    });
  }
}
