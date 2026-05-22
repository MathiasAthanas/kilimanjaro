import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { AssignStudentGroupDto, CreateStudentGroupDto } from './dto/student-group.dto';

@Injectable()
export class FeeStructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  private decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  async create(dto: CreateFeeStructureDto, user: RequestUser) {
    if (!dto.classId && dto.classLevel === undefined && !dto.educationStage && !dto.studentGroup) {
      throw new BadRequestException('Provide classId, educationStage/classLevel, or studentGroup');
    }
    if (dto.classLevel !== undefined && !dto.educationStage && !dto.classId) {
      throw new BadRequestException('Provide educationStage when targeting by classLevel');
    }

    const row = await this.prisma.feeStructure.create({
      data: {
        feeCategoryId: dto.feeCategoryId,
        classId: dto.classId,
        educationStage: dto.educationStage,
        classLevel: dto.classLevel,
        studentGroup: dto.studentGroup,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        amount: this.decimal(dto.amount),
        currency: dto.currency || 'TZS',
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        createdById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'FeeStructure',
      entityId: row.id,
      action: FinancialAuditAction.FEE_STRUCTURE_CREATED,
      performedById: user.id,
      performedByRole: user.role,
      newValue: row,
    });
    await this.redis.delByPattern('fee-structures:*');
    await this.redis.delByPattern('fee-matrix:*');
    return row;
  }

  list(filters: {
    feeCategoryId?: string;
    classId?: string;
    educationStage?: string;
    classLevel?: string;
    studentGroup?: string;
    academicYearId?: string;
    termId?: string;
    isActive?: string;
  }) {
    return this.prisma.feeStructure.findMany({
      where: {
        feeCategoryId: filters.feeCategoryId,
        classId: filters.classId,
        educationStage: filters.educationStage as any,
        classLevel: filters.classLevel ? Number(filters.classLevel) : undefined,
        studentGroup: filters.studentGroup,
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
      },
      include: { feeCategory: true },
      orderBy: [{ academicYearId: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async matrix(filters: { academicYearId: string; termId?: string; educationStage?: string }) {
    const cacheKey = `fee-matrix:${filters.academicYearId}:${filters.termId || 'ANNUAL'}:${filters.educationStage || 'ALL'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.feeStructure.findMany({
      where: {
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        educationStage: filters.educationStage as any,
        isActive: true,
      },
      include: { feeCategory: true },
      orderBy: [{ classId: 'asc' }, { feeCategory: { displayOrder: 'asc' } }],
    });

    const classes = [...new Set(rows.map((r) => r.classId).filter(Boolean))];
    const categories = [...new Map(rows.map((r) => [r.feeCategoryId, r.feeCategory])).values()];
    const matrix: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      const classKey = row.classId || row.studentGroup || `${row.educationStage || 'ANY'}_LEVEL_${row.classLevel}`;
      if (!matrix[classKey]) matrix[classKey] = {};
      matrix[classKey][row.feeCategoryId] = row.amount.toString();
    }

    const payload = { classes, categories, matrix };
    await this.redis.set(cacheKey, payload, 3600);
    return payload;
  }

  async update(id: string, dto: UpdateFeeStructureDto, user: RequestUser) {
    const existing = await this.prisma.feeStructure.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fee structure not found');

    if (dto.amount && dto.amount !== existing.amount.toString()) {
      const linkedDraftSafe = await this.prisma.invoiceLineItem.findFirst({
        where: {
          feeStructureId: id,
          invoice: { status: { not: 'DRAFT' } },
        },
      });
      if (linkedDraftSafe) {
        throw new ConflictException('Cannot change amount after non-draft invoices exist');
      }
    }

    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: {
        feeCategoryId: dto.feeCategoryId,
        classId: dto.classId,
        educationStage: dto.educationStage,
        classLevel: dto.classLevel,
        studentGroup: dto.studentGroup,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        amount: dto.amount ? this.decimal(dto.amount) : undefined,
        currency: dto.currency,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        updatedById: user.id,
      },
    });

    await this.audit.log({
      entityType: 'FeeStructure',
      entityId: id,
      action: FinancialAuditAction.FEE_STRUCTURE_UPDATED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: updated,
    });
    await this.redis.delByPattern('fee-structures:*');
    await this.redis.delByPattern('fee-matrix:*');
    return updated;
  }

  async deactivate(id: string, user: RequestUser) {
    const existing = await this.prisma.feeStructure.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fee structure not found');

    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: { isActive: false, updatedById: user.id },
    });

    await this.audit.log({
      entityType: 'FeeStructure',
      entityId: id,
      action: FinancialAuditAction.FEE_STRUCTURE_DEACTIVATED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async createStudentGroup(dto: CreateStudentGroupDto, user: RequestUser) {
    return this.prisma.studentGroup.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        createdById: user.id,
      },
      update: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listStudentGroups(filters: { isActive?: string }) {
    return this.prisma.studentGroup.findMany({
      where: { isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true' },
      include: { memberships: { where: { isActive: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async assignStudentGroup(dto: AssignStudentGroupDto, user: RequestUser) {
    const group = await this.prisma.studentGroup.findUnique({ where: { id: dto.groupId } });
    if (!group || !group.isActive) {
      throw new BadRequestException('Student group not found or inactive');
    }
    return this.prisma.studentGroupMembership.upsert({
      where: { studentId_groupId: { studentId: dto.studentId, groupId: dto.groupId } },
      create: {
        studentId: dto.studentId,
        groupId: dto.groupId,
        assignedById: user.id,
        notes: dto.notes,
      },
      update: { isActive: true, notes: dto.notes, assignedById: user.id, assignedAt: new Date() },
      include: { group: true },
    });
  }

  async removeStudentGroupMembership(id: string) {
    const existing = await this.prisma.studentGroupMembership.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student group membership not found');
    }
    return this.prisma.studentGroupMembership.update({ where: { id }, data: { isActive: false }, include: { group: true } });
  }
}
