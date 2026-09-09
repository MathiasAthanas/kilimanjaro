import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  assertSchoolInScope,
  isGroupScope,
  resolveWriteSchoolId,
  schoolScopeFilter,
} from '../common/helpers/school-scope.helper';
import { CreateExamTypeDto, UpdateExamTypeDto } from './dto/exam-type.dto';

@Injectable()
export class ExamTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Visibility filter: a user sees exam types belonging to their school(s) AND
   * group-wide (schoolId = null) types shared across the whole group.
   */
  private visibilityFilter(user?: RequestUser): Prisma.ExamTypeWhereInput {
    if (isGroupScope(user)) {
      // Group roles: an active school narrows to that school + shared globals.
      return user?.activeSchoolId
        ? { OR: [{ schoolId: user.activeSchoolId }, { schoolId: null }] }
        : {};
    }
    const scoped = schoolScopeFilter(user);
    return { OR: [scoped as Prisma.ExamTypeWhereInput, { schoolId: null }] };
  }

  async create(dto: CreateExamTypeDto, user?: RequestUser) {
    const schoolId = resolveWriteSchoolId(user);

    const existing = await this.prisma.examType.findFirst({
      where: { code: dto.code, schoolId: schoolId ?? null },
    });
    if (existing) {
      throw new BadRequestException(`An exam type with code "${dto.code}" already exists.`);
    }

    return this.prisma.examType.create({
      data: {
        schoolId,
        name: dto.name,
        code: dto.code.toUpperCase().trim(),
        description: dto.description,
        defaultWeight: dto.defaultWeight ?? 100,
        educationStage: dto.educationStage as any,
        color: dto.color ?? '#4338CA',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        createdById: user?.id,
      },
    });
  }

  async list(
    filters: { educationStage?: string; isActive?: boolean } = {},
    user?: RequestUser,
  ) {
    return this.prisma.examType.findMany({
      where: {
        ...this.visibilityFilter(user),
        educationStage: filters.educationStage as any,
        isActive: filters.isActive,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private async getOrThrow(id: string, user?: RequestUser) {
    const type = await this.prisma.examType.findUnique({ where: { id } });
    if (!type) {
      throw new NotFoundException('Exam type not found');
    }
    assertSchoolInScope(user, type.schoolId ?? null);
    return type;
  }

  async update(id: string, dto: UpdateExamTypeDto, user?: RequestUser) {
    const existing = await this.getOrThrow(id, user);

    if (dto.code && dto.code.toUpperCase().trim() !== existing.code) {
      const clash = await this.prisma.examType.findFirst({
        where: { code: dto.code.toUpperCase().trim(), schoolId: existing.schoolId ?? null, id: { not: id } },
      });
      if (clash) {
        throw new BadRequestException(`An exam type with code "${dto.code}" already exists.`);
      }
    }

    return this.prisma.examType.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code ? dto.code.toUpperCase().trim() : undefined,
        description: dto.description,
        defaultWeight: dto.defaultWeight,
        educationStage: dto.educationStage as any,
        color: dto.color,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string, user?: RequestUser): Promise<void> {
    await this.getOrThrow(id, user);
    const windowCount = await this.prisma.examWindow.count({ where: { examTypeId: id } });
    if (windowCount > 0) {
      throw new BadRequestException(
        `Cannot delete this exam type — ${windowCount} exam window(s) use it. Deactivate it instead.`,
      );
    }
    await this.prisma.examType.delete({ where: { id } });
  }

  /**
   * One-shot, idempotent backfill of the legacy AssessmentType catalogue into
   * ExamType. Distinct (code, name) pairs become exam types; the weight carries
   * over as defaultWeight. Existing exam-type codes are skipped, so it is safe
   * to run more than once.
   */
  async migrateFromAssessmentTypes(user?: RequestUser) {
    const schoolId = resolveWriteSchoolId(user);
    const legacy = await this.prisma.assessmentType.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Collapse to distinct code, keeping the highest weight seen for that code.
    const byCode = new Map<string, { name: string; code: string; weight: number; stage: string | null }>();
    for (const t of legacy) {
      const code = t.code.toUpperCase().trim();
      const prev = byCode.get(code);
      if (!prev || t.weightPercentage > prev.weight) {
        byCode.set(code, {
          name: t.name,
          code,
          weight: t.weightPercentage,
          stage: (t.educationStage as string | null) ?? null,
        });
      }
    }

    const existing = await this.prisma.examType.findMany({
      where: { schoolId: schoolId ?? null },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((e) => e.code));

    let created = 0;
    let order = existing.length;
    for (const entry of byCode.values()) {
      if (existingCodes.has(entry.code)) {
        continue;
      }
      await this.prisma.examType.create({
        data: {
          schoolId,
          name: entry.name,
          code: entry.code,
          defaultWeight: entry.weight,
          educationStage: entry.stage as any,
          sortOrder: order++,
          createdById: user?.id,
        },
      });
      created += 1;
    }

    return { legacyTypes: legacy.length, distinctCodes: byCode.size, created, skipped: byCode.size - created };
  }
}
