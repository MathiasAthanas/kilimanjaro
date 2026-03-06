import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Finance - Internal')
@Controller('finance/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

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
