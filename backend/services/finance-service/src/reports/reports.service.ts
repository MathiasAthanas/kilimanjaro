import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessControlService } from '../common/helpers/access-control.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

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

    const totalBilled = invoiceAgg._sum.totalAmount || new Prisma.Decimal(0);
    const totalCollected = invoiceAgg._sum.paidAmount || new Prisma.Decimal(0);
    const totalOutstanding = invoiceAgg._sum.outstandingBalance || new Prisma.Decimal(0);
    const overdueAmount = overdueAmountAgg._sum.outstandingBalance || new Prisma.Decimal(0);

    return {
      totalBilled: totalBilled.toString(),
      totalCollected: totalCollected.toString(),
      totalOutstanding: totalOutstanding.toString(),
      collectionRate:
        totalBilled.gt(0) ? totalCollected.div(totalBilled).mul(100).toDecimalPlaces(2).toString() : '0',
      byPaymentMethod: paymentAgg.map((row) => ({
        method: row.method,
        totalAmount: (row._sum.amount || new Prisma.Decimal(0)).toString(),
        transactionCount: row._count._all,
      })),
      overdueCount,
      overdueAmount: overdueAmount.toString(),
      byClass: [],
      byFeeCategory: [],
    };
  }

  async outstandingBalances(filters: { termId?: string; academicYearId?: string; classId?: string; minAmount?: string }) {
    const min = filters.minAmount ? new Prisma.Decimal(filters.minAmount) : new Prisma.Decimal(0);
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
