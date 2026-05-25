import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateSubjectCombinationDto } from './dto/create-subject-combination.dto';
import { CreateStudentSubjectEnrollmentDto } from './dto/create-student-subject-enrollment.dto';
import { BulkStudentSubjectEnrollmentDto } from './dto/bulk-student-subject-enrollment.dto';
import { UpdateClassSubjectDto } from './dto/update-class-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createSubject(dto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({ data: dto });
    await this.redis.del('subjects:all');
    return subject;
  }

  async listSubjects(filters: { isActive?: string; isCompulsory?: string; educationStage?: string }) {
    const cacheKey = 'subjects:all';
    if (!filters.isActive && !filters.isCompulsory && !filters.educationStage) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const subjects = await this.prisma.subject.findMany({
      where: {
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
        isCompulsory: filters.isCompulsory === undefined ? undefined : filters.isCompulsory === 'true',
        educationStage: filters.educationStage as any,
      },
      orderBy: { name: 'asc' },
    });

    if (!filters.isActive && !filters.isCompulsory && !filters.educationStage) {
      await this.redis.set(cacheKey, subjects, 1800);
    }

    return subjects;
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Subject not found');
    }

    const subject = await this.prisma.subject.update({ where: { id }, data: dto });
    await this.redis.del('subjects:all');
    return subject;
  }

  async createClassSubject(dto: CreateClassSubjectDto) {
    return this.prisma.classSubject.create({
      data: {
        ...dto,
        educationStage: dto.educationStage ?? 'O_LEVEL',
      },
      include: { subject: true, combination: true },
    });
  }

  async listClassSubjects(filters: {
    classId?: string;
    academicYearId?: string;
    teacherId?: string;
    subjectId?: string;
    educationStage?: string;
    classLevel?: number;
    combinationId?: string;
  }) {
    return this.prisma.classSubject.findMany({
      where: {
        classId: filters.classId,
        academicYearId: filters.academicYearId,
        teacherId: filters.teacherId,
        subjectId: filters.subjectId,
        educationStage: filters.educationStage as any,
        classLevel: filters.classLevel,
        combinationId: filters.combinationId,
      },
      include: { subject: true, combination: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClassSubject(id: string, dto: UpdateClassSubjectDto) {
    const existing = await this.prisma.classSubject.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class subject not found');
    }

    return this.prisma.classSubject.update({ where: { id }, data: dto, include: { subject: true, combination: true } });
  }

  async createSubjectCombination(dto: CreateSubjectCombinationDto) {
    if ((dto.educationStage ?? 'A_LEVEL') !== 'A_LEVEL') {
      throw new BadRequestException('Subject combinations are only supported for A-Level');
    }
    await this.assertCombinationSubjectsActive(dto.subjects.map((s) => s.subjectId));
    this.assertALevelCombinationValid(dto.subjects);
    try {
      return await this.prisma.subjectCombination.create({
        data: {
          code: dto.code,
          name: dto.name,
          educationStage: dto.educationStage ?? 'A_LEVEL',
          academicYearId: dto.academicYearId,
          isActive: dto.isActive ?? true,
          subjects: {
            create: dto.subjects.map((s, index) => {
              const role = s.subjectRole ?? (s.isPrincipal === false ? 'SUBSIDIARY' : 'PRINCIPAL');
              return {
                subjectId: s.subjectId,
                isPrincipal: role === 'PRINCIPAL',
                subjectRole: role,
                displayOrder: s.displayOrder ?? index,
              };
            }),
          },
        },
        include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException(`Combination ${dto.code} already exists for this academic year`);
      }
      throw error;
    }
  }

  private async assertCombinationSubjectsActive(subjectIds: string[]) {
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: subjectIds }, isActive: true } });
    if (subjects.length !== new Set(subjectIds).size) {
      throw new BadRequestException('Every combination subject must exist and be active');
    }
  }

  /**
   * A-Level ACSEE combination rules:
   *  - At least 2 principal subjects.
   *  - At least one compulsory subsidiary (General Studies / General Paper).
   */
  private assertALevelCombinationValid(subjects: CreateSubjectCombinationDto['subjects']) {
    const principalCount = subjects.filter((s) => {
      const role = s.subjectRole ?? (s.isPrincipal === false ? 'SUBSIDIARY' : 'PRINCIPAL');
      return role === 'PRINCIPAL';
    }).length;

    const hasCompulsorySubsidiary = subjects.some((s) => s.subjectRole === 'COMPULSORY_SUBSIDIARY');

    if (principalCount < 2) {
      throw new BadRequestException(
        'An A-Level combination must have at least 2 principal subjects',
      );
    }
    if (!hasCompulsorySubsidiary) {
      throw new BadRequestException(
        'An A-Level combination must include at least one Compulsory Subsidiary (e.g. General Studies / General Paper)',
      );
    }
  }

  async updateSubjectCombination(id: string, dto: Partial<CreateSubjectCombinationDto>) {
    const existing = await this.prisma.subjectCombination.findUnique({
      where: { id },
      include: { subjects: true },
    });
    if (!existing) {
      throw new NotFoundException('Subject combination not found');
    }
    if (dto.educationStage && dto.educationStage !== 'A_LEVEL') {
      throw new BadRequestException('Subject combinations are only supported for A-Level');
    }
    if (dto.subjects) {
      await this.assertCombinationSubjectsActive(dto.subjects.map((s) => s.subjectId));
      this.assertALevelCombinationValid(dto.subjects);
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.subjects) {
        await tx.subjectCombinationSubject.deleteMany({ where: { combinationId: id } });
      }
      return tx.subjectCombination.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          educationStage: dto.educationStage,
          academicYearId: dto.academicYearId,
          isActive: dto.isActive,
          subjects: dto.subjects
            ? {
                create: dto.subjects.map((s, index) => {
                  const role = s.subjectRole ?? (s.isPrincipal === false ? 'SUBSIDIARY' : 'PRINCIPAL');
                  return {
                    subjectId: s.subjectId,
                    isPrincipal: role === 'PRINCIPAL',
                    subjectRole: role,
                    displayOrder: s.displayOrder ?? index,
                  };
                }),
              }
            : undefined,
        },
        include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
      });
    });
  }

  async deactivateSubjectCombination(id: string) {
    const existing = await this.prisma.subjectCombination.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Subject combination not found');
    }
    return this.prisma.subjectCombination.update({
      where: { id },
      data: { isActive: false },
      include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
    });
  }

  async listSubjectCombinations(filters: { academicYearId?: string; educationStage?: string; isActive?: string }) {
    return this.prisma.subjectCombination.findMany({
      where: {
        academicYearId: filters.academicYearId,
        educationStage: filters.educationStage as any,
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
      },
      include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
      orderBy: [{ academicYearId: 'desc' }, { code: 'asc' }],
    });
  }

  async enrollStudentSubject(dto: CreateStudentSubjectEnrollmentDto) {
    if (dto.combinationId) {
      const combination = await this.prisma.subjectCombination.findUnique({
        where: { id: dto.combinationId },
        include: { subjects: true },
      });
      if (!combination || combination.educationStage !== 'A_LEVEL' || !combination.isActive) {
        throw new BadRequestException('A-Level subject enrollment requires an active A-Level combination');
      }
      if (!combination.subjects.some((subject) => subject.subjectId === dto.subjectId)) {
        throw new BadRequestException('Subject is not part of the selected A-Level combination');
      }
    }
    const existing = await this.prisma.studentSubjectEnrollment.findFirst({
      where: {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
      },
    });

    if (existing) {
      return this.prisma.studentSubjectEnrollment.update({
        where: { id: existing.id },
        data: {
          classId: dto.classId,
          combinationId: dto.combinationId,
          isActive: dto.isActive ?? true,
        },
        include: { subject: true, combination: true },
      });
    }

    return this.prisma.studentSubjectEnrollment.create({
      data: {
        studentId: dto.studentId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        combinationId: dto.combinationId,
        isActive: dto.isActive ?? true,
      },
      include: { subject: true, combination: true },
    });
  }

  async updateStudentSubjectEnrollment(id: string, dto: Partial<CreateStudentSubjectEnrollmentDto>) {
    const existing = await this.prisma.studentSubjectEnrollment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student subject enrollment not found');
    }
    return this.prisma.studentSubjectEnrollment.update({
      where: { id },
      data: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        combinationId: dto.combinationId,
        isActive: dto.isActive,
      },
      include: { subject: true, combination: true },
    });
  }

  async deactivateStudentSubjectEnrollment(id: string) {
    const existing = await this.prisma.studentSubjectEnrollment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student subject enrollment not found');
    }
    return this.prisma.studentSubjectEnrollment.update({
      where: { id },
      data: { isActive: false },
      include: { subject: true, combination: true },
    });
  }

  async bulkEnrollStudentCombination(dto: BulkStudentSubjectEnrollmentDto) {
    const combination = await this.prisma.subjectCombination.findUnique({
      where: { id: dto.combinationId },
      include: { subjects: true },
    });
    if (!combination || combination.educationStage !== 'A_LEVEL' || !combination.isActive) {
      throw new BadRequestException('Bulk assignment requires an active A-Level combination');
    }
    const rows: Array<Promise<unknown>> = [];
    for (const studentId of dto.studentIds) {
      for (const subject of combination.subjects) {
        rows.push(
          this.enrollStudentSubject({
            studentId,
            classId: dto.classId,
            academicYearId: dto.academicYearId,
            termId: dto.termId,
            combinationId: dto.combinationId,
            subjectId: subject.subjectId,
            isActive: true,
          }),
        );
      }
    }
    const saved = await Promise.all(rows);
    return {
      combinationId: dto.combinationId,
      studentsAssigned: dto.studentIds.length,
      subjectEnrollments: saved.length,
      items: saved,
    };
  }

  async listStudentSubjectEnrollments(filters: {
    studentId?: string;
    classId?: string;
    academicYearId?: string;
    combinationId?: string;
  }) {
    return this.prisma.studentSubjectEnrollment.findMany({
      where: {
        studentId: filters.studentId,
        classId: filters.classId,
        academicYearId: filters.academicYearId,
        combinationId: filters.combinationId,
        isActive: true,
      },
      include: { subject: true, combination: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
