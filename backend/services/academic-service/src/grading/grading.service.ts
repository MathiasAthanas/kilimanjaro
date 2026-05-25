import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateAssessmentTypeDto } from './dto/create-assessment-type.dto';
import { CreateGradingScaleDto } from './dto/create-grading-scale.dto';

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private validateBoundaries(grades: CreateGradingScaleDto['grades']): void {
    const sorted = [...grades].sort((a, b) => a.minScore - b.minScore);
    if (sorted[0]?.minScore !== 0 || sorted[sorted.length - 1]?.maxScore !== 100) {
      throw new BadRequestException('Grade boundaries must cover 0-100');
    }

    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i].minScore > sorted[i].maxScore) {
        throw new BadRequestException('Invalid grade boundary range');
      }

      const gapFromPrevious = i > 0 ? sorted[i].minScore - sorted[i - 1].maxScore : 0;
      if (i > 0 && (gapFromPrevious < 0 || gapFromPrevious > 1.0001)) {
        throw new BadRequestException('Grade boundaries must be contiguous with no gaps/overlaps');
      }
    }
  }

  async createGradingScale(dto: CreateGradingScaleDto) {
    this.validateBoundaries(dto.grades);

    const scale = await this.prisma.gradingScale.create({
      data: {
        name: dto.name,
        academicYearId: dto.academicYearId,
        educationStage: dto.educationStage,
        classLevel: dto.classLevel,
        subjectId: dto.subjectId,
        grades: {
          create: dto.grades,
        },
      },
      include: { grades: { orderBy: { minScore: 'asc' } } },
    });

    await this.redis.delByPattern(`grading-scale:active:${dto.academicYearId}:*`);
    return scale;
  }

  async listGradingScales(filters: {
    academicYearId?: string;
    educationStage?: string;
    classLevel?: number;
    subjectId?: string;
  } = {}) {
    return this.prisma.gradingScale.findMany({
      where: {
        academicYearId: filters.academicYearId,
        educationStage: filters.educationStage as any,
        classLevel: filters.classLevel,
        subjectId: filters.subjectId,
      },
      include: { grades: { orderBy: { minScore: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activateGradingScale(id: string) {
    const existing = await this.prisma.gradingScale.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Grading scale not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.gradingScale.updateMany({
        where: {
          academicYearId: existing.academicYearId,
          educationStage: existing.educationStage,
          classLevel: existing.classLevel,
          subjectId: existing.subjectId,
          isActive: true,
        },
        data: { isActive: false },
      });

      return tx.gradingScale.update({
        where: { id },
        data: { isActive: true },
        include: { grades: { orderBy: { minScore: 'asc' } } },
      });
    });

    await this.redis.delByPattern(`grading-scale:active:${existing.academicYearId}:*`);
    return result;
  }

  async createAssessmentType(dto: CreateAssessmentTypeDto) {
    const currentTotal = await this.prisma.assessmentType.aggregate({
      _sum: { weightPercentage: true },
      where: {
        academicYearId: dto.academicYearId,
        educationStage: dto.educationStage,
        classLevel: dto.classLevel,
        subjectId: dto.subjectId,
        isActive: true,
      },
    });

    const total = (currentTotal._sum.weightPercentage ?? 0) + dto.weightPercentage;
    if (total > 100.001) {
      throw new BadRequestException('Assessment type weights exceed 100%');
    }

    const type = await this.prisma.assessmentType.create({ data: dto });
    await this.redis.delByPattern(`assessment-types:${dto.academicYearId}:*`);
    return type;
  }

  async updateAssessmentType(id: string, dto: Partial<CreateAssessmentTypeDto>) {
    const existing = await this.prisma.assessmentType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment type not found');
    }

    if (dto.weightPercentage !== undefined && dto.isActive !== false) {
      const currentTotal = await this.prisma.assessmentType.aggregate({
        _sum: { weightPercentage: true },
        where: {
          academicYearId: dto.academicYearId ?? existing.academicYearId,
          educationStage: (dto.educationStage ?? existing.educationStage) as any,
          classLevel: dto.classLevel ?? existing.classLevel,
          subjectId: dto.subjectId ?? existing.subjectId,
          isActive: true,
          id: { not: id },
        },
      });

      const total = (currentTotal._sum.weightPercentage ?? 0) + dto.weightPercentage;
      if (total > 100.001) {
        throw new BadRequestException('Assessment type weights exceed 100%');
      }
    }

    const updated = await this.prisma.assessmentType.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        weightPercentage: dto.weightPercentage,
        academicYearId: dto.academicYearId,
        educationStage: dto.educationStage as any,
        classLevel: dto.classLevel,
        subjectId: dto.subjectId,
        isActive: dto.isActive,
      },
    });
    await this.redis.delByPattern(`assessment-types:${updated.academicYearId}:*`);
    return updated;
  }

  async listAssessmentTypes(filters: {
    academicYearId?: string;
    educationStage?: string;
    classLevel?: number;
    subjectId?: string;
  } = {}) {
    const cacheKey = filters.academicYearId
      ? `assessment-types:${filters.academicYearId}:${filters.educationStage ?? 'ALL'}:${filters.classLevel ?? 'ALL'}:${filters.subjectId ?? 'ALL'}`
      : '';
    if (cacheKey) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const types = await this.prisma.assessmentType.findMany({
      where: {
        academicYearId: filters.academicYearId,
        educationStage: filters.educationStage as any,
        classLevel: filters.classLevel,
        subjectId: filters.subjectId,
      },
      orderBy: [{ academicYearId: 'asc' }, { educationStage: 'asc' }, { classLevel: 'asc' }, { code: 'asc' }],
    });

    if (cacheKey) {
      await this.redis.set(cacheKey, types, 3600);
    }

    return types;
  }
}
