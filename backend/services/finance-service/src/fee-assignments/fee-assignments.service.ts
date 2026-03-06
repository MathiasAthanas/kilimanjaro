import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { AssignFeeDto } from './dto/assign-fee.dto';
import { BulkAssignFeeDto } from './dto/bulk-assign-fee.dto';

@Injectable()
export class FeeAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  private async assignOne(studentId: string, dto: AssignFeeDto, user: RequestUser) {
    const category = await this.prisma.feeCategory.findUnique({ where: { id: dto.feeCategoryId } });
    if (!category) throw new NotFoundException('Fee category not found');
    if (!category.isOptional) throw new ConflictException('Only optional categories can be assigned');

    const existing = await this.prisma.studentFeeAssignment.findFirst({
      where: {
        studentId,
        feeCategoryId: dto.feeCategoryId,
        academicYearId: dto.academicYearId,
        termId: dto.termId ?? null,
      },
    });

    const record = existing
      ? await this.prisma.studentFeeAssignment.update({
          where: { id: existing.id },
          data: { isActive: true, notes: dto.notes },
        })
      : await this.prisma.studentFeeAssignment.create({
          data: {
            studentId,
            feeCategoryId: dto.feeCategoryId,
            academicYearId: dto.academicYearId,
            termId: dto.termId ?? null,
            assignedById: user.id,
            notes: dto.notes,
          },
        });

    await this.audit.log({
      entityType: 'StudentFeeAssignment',
      entityId: record.id,
      action: FinancialAuditAction.STUDENT_FEE_ASSIGNED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: record,
    });

    await this.rabbitMq.publish('invoice.updated', {
      studentId,
      reason: 'Optional fee assignment updated',
    });

    return record;
  }

  async bulk(dto: BulkAssignFeeDto, user: RequestUser) {
    let assigned = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const studentId of dto.studentIds) {
      try {
        await this.assignOne(studentId, dto, user);
        assigned += 1;
      } catch (error) {
        skipped += 1;
        errors.push(`${studentId}: ${(error as Error).message}`);
      }
    }

    return { assigned, skipped, errors };
  }

  assign(studentId: string, dto: AssignFeeDto, user: RequestUser) {
    return this.assignOne(studentId, dto, user);
  }

  list(filters: { studentId?: string; feeCategoryId?: string; academicYearId?: string; termId?: string; isActive?: string }) {
    return this.prisma.studentFeeAssignment.findMany({
      where: {
        studentId: filters.studentId,
        feeCategoryId: filters.feeCategoryId,
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
      },
      include: { feeCategory: true },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async remove(id: string, user: RequestUser) {
    const existing = await this.prisma.studentFeeAssignment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment not found');

    const invoiced = await this.prisma.invoiceLineItem.findFirst({
      where: {
        feeCategoryId: existing.feeCategoryId,
        invoice: {
          studentId: existing.studentId,
          academicYearId: existing.academicYearId,
          termId: existing.termId || undefined,
          status: { not: 'DRAFT' },
        },
      },
    });
    if (invoiced) {
      throw new ConflictException('Cannot remove assignment after billing');
    }

    await this.prisma.studentFeeAssignment.update({ where: { id }, data: { isActive: false } });

    await this.audit.log({
      entityType: 'StudentFeeAssignment',
      entityId: id,
      action: FinancialAuditAction.STUDENT_FEE_REMOVED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
    });

    return { removed: true };
  }
}
