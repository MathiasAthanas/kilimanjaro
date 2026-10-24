import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Finance - Internal')
@Controller('finance/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('lifecycle-usage')
  async lifecycleUsage(
    @Query('studentIds') rawStudentIds = '',
    @Query('classId') classId?: string,
  ) {
    const studentIds = [...new Set(rawStudentIds.split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 500);
    const studentWhere = studentIds.length ? { studentId: { in: studentIds } } : { studentId: '__none__' };
    const [assignments, invoices, payments, receipts, feeStructures, classInvoices, classReceipts] = await Promise.all([
      this.prisma.studentFeeAssignment.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.invoice.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.payment.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.receipt.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      classId ? this.prisma.feeStructure.count({ where: { classId } }) : Promise.resolve(0),
      classId ? this.prisma.invoice.count({ where: { classId } }) : Promise.resolve(0),
      classId ? this.prisma.receipt.count({ where: { classId } }) : Promise.resolve(0),
    ]);
    const protectedStudentIds = [...new Set([
      ...assignments, ...invoices, ...payments, ...receipts,
    ].map((item) => item.studentId))];
    return {
      protectedStudentIds,
      counts: {
        feeAssignments: assignments.length,
        invoices: invoices.length,
        payments: payments.length,
        receipts: receipts.length,
      },
      classRecords: { feeStructures, invoices: classInvoices, receipts: classReceipts },
    };
  }

  @Get('student/:studentId/balance')
  async balance(@Param('studentId') studentId: string) {
    const agg = await this.prisma.invoice.aggregate({
      where: {
        studentId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _sum: { outstandingBalance: true },
    });

    const overdue = await this.prisma.invoice.aggregate({
      where: { studentId, status: 'OVERDUE' },
      _sum: { outstandingBalance: true },
    });

    return {
      studentId,
      outstandingBalance: agg._sum.outstandingBalance || 0,
      overdueAmount: overdue._sum.outstandingBalance || 0,
      hasActiveInvoice: Number(agg._sum.outstandingBalance || 0) > 0,
    };
  }

  @Get('student/:studentId/invoices')
  async invoices(@Param('studentId') studentId: string) {
    return this.prisma.invoice.findMany({
      where: { studentId },
      select: {
        id: true,
        invoiceNumber: true,
        termId: true,
        academicYearId: true,
        totalAmount: true,
        paidAmount: true,
        outstandingBalance: true,
        status: true,
        dueDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
