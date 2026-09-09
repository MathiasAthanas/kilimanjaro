import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Prisma,
  StudentStatus,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { BulkPromoteStudentsDto } from './dto/bulk-promote-students.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { paginate, buildPageMeta } from '../common/helpers/pagination.helper';
import {
  formatRegistrationNumber,
  formatRegistrationNumberWithStage,
  type EducationStageCode,
} from '../common/helpers/registration-number.helper';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { assertSchoolInScope, resolveWriteSchoolId, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Gap 9 — stage-prefixed registration numbers.
   *
   * When a classId is supplied we look up the class's educationStage
   * and use the per-stage sequence table so Primary, O-Level and
   * A-Level students never share sequence numbers.
   *
   * Falls back to the legacy global sequence when no stage is known.
   */
  private async generateRegistrationNumber(
    tx: Prisma.TransactionClient,
    date: Date,
    classId?: string,
  ): Promise<string> {
    const year = date.getUTCFullYear();

    // Resolve stage from the class when available
    let stage: EducationStageCode | null = null;
    if (classId) {
      const cls = await tx.class.findUnique({ where: { id: classId }, select: { educationStage: true } });
      stage = (cls?.educationStage as EducationStageCode) ?? null;
    }

    // The sequence can lag behind reality (bulk imports / seeds insert fixed
    // numbers without touching it), so skip ahead past any taken numbers.
    const MAX_ATTEMPTS = 1000;

    if (stage) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const seq = await (tx as any).registrationSequenceByStage.upsert({
          where: { year_stage: { year, stage } },
          create: { year, stage, nextValue: 2 },
          update: { nextValue: { increment: 1 } },
          select: { nextValue: true },
        });
        const candidate = formatRegistrationNumberWithStage(year, seq.nextValue - 1, stage);
        const taken = await tx.student.findUnique({ where: { registrationNumber: candidate }, select: { id: true } });
        if (!taken) return candidate;
      }
      throw new BadRequestException('Unable to allocate a registration number — sequence exhausted');
    }

    // Legacy fallback (no stage info)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const sequence = await tx.registrationSequence.upsert({
        where: { year },
        create: { year, nextValue: 2 },
        update: { nextValue: { increment: 1 } },
        select: { nextValue: true },
      });
      const candidate = formatRegistrationNumber(year, sequence.nextValue - 1);
      const taken = await tx.student.findUnique({ where: { registrationNumber: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    throw new BadRequestException('Unable to allocate a registration number — sequence exhausted');
  }

  private buildStudentProfileInclude(): Prisma.StudentInclude {
    return {
      enrolments: {
        where: { isActive: true },
        include: {
          class: true,
          academicYear: true,
          term: true,
        },
        orderBy: { enrolledAt: 'desc' },
        take: 1,
      },
      parentLinks: {
        where: { isActive: true },
        include: { guardian: true },
      },
    };
  }

  async create(dto: CreateStudentDto, actorId: string, user?: RequestUser): Promise<unknown> {
    const admissionDate = new Date(dto.admissionDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const classExists = await tx.class.findUnique({ where: { id: dto.classId } });
      if (!classExists) {
        throw new BadRequestException('Class not found');
      }
      // The class owns the student. Never trust a client-supplied class id
      // unless it belongs to the actor's selected/in-scope school.
      resolveWriteSchoolId(user, classExists.schoolId);

      const academicYear = await tx.academicYear.findUnique({ where: { id: dto.academicYearId } });
      if (!academicYear) {
        throw new BadRequestException('Academic year not found');
      }

      const registrationNumber = await this.generateRegistrationNumber(tx, admissionDate, dto.classId);

      // Bind the enrolment to the current term so term-based flows (fee invoicing,
      // results) pick the new student up. Falls back to any current term for the year.
      const enrolmentTerm = await tx.term.findFirst({
        where: { academicYearId: dto.academicYearId, isCurrent: true },
        select: { id: true },
      });

      const student = await tx.student.create({
        data: {
          registrationNumber,
          schoolId: classExists.schoolId,
          authUserId: dto.authUserId,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          nationality: dto.nationality || 'Tanzanian',
          admissionDate,
          createdBy: actorId,
          status: StudentStatus.ACTIVE,
          enrolments: {
            create: {
              classId: dto.classId,
              academicYearId: dto.academicYearId,
              termId: enrolmentTerm?.id ?? null,
              schoolId: classExists.schoolId,
              isActive: true,
            },
          },
        },
      });

      for (const guardian of dto.guardians) {
        const guardianRecord = guardian.authUserId
          ? await tx.guardian.upsert({
              where: { authUserId: guardian.authUserId },
              create: {
                authUserId: guardian.authUserId,
                firstName: guardian.firstName,
                lastName: guardian.lastName,
                relationship: guardian.relationship,
                phoneNumber: guardian.phoneNumber,
                email: guardian.email,
              },
              update: {
                firstName: guardian.firstName,
                lastName: guardian.lastName,
                relationship: guardian.relationship,
                phoneNumber: guardian.phoneNumber,
                email: guardian.email,
              },
            })
          : await tx.guardian.create({
              data: {
                authUserId: randomUUID(),
                firstName: guardian.firstName,
                lastName: guardian.lastName,
                relationship: guardian.relationship,
                phoneNumber: guardian.phoneNumber,
                email: guardian.email,
              },
            });

        await tx.studentGuardianLink.upsert({
          where: {
            studentId_guardianId: {
              studentId: student.id,
              guardianId: guardianRecord.id,
            },
          },
          create: {
            studentId: student.id,
            guardianId: guardianRecord.id,
            isPrimary: Boolean(guardian.isPrimary),
            isActive: true,
          },
          update: {
            isPrimary: Boolean(guardian.isPrimary),
            isActive: true,
            unlinkedAt: null,
          },
        });
      }

      return tx.student.findUnique({
        where: { id: student.id },
        include: this.buildStudentProfileInclude(),
      });
    });

    if (!created) {
      throw new BadRequestException('Failed to create student');
    }

    await this.rabbitMq.publish('student.enrolled', {
      studentId: (created as { id: string }).id,
      registrationNumber: (created as { registrationNumber: string }).registrationNumber,
      classId: dto.classId,
      academicYearId: dto.academicYearId,
      enrolledBy: actorId,
    });

    await this.redis.set(`student:${(created as { id: string }).id}:profile`, created, 300);
    await this.redis.set(`student:reg:${(created as { registrationNumber: string }).registrationNumber}`, created, 300);

    return created;
  }

  async stats(user?: RequestUser) {
    const scope = schoolScopeFilter(user);
    const [total, byStatusRaw] = await Promise.all([
      this.prisma.student.count({ where: scope }),
      this.prisma.student.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    ]);
    const byStatus = byStatusRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    return { total, byStatus };
  }

  async list(query: ListStudentsDto, user?: RequestUser): Promise<unknown> {
    const pagination = paginate(query.page, query.limit);

    const where: Prisma.StudentWhereInput = {
      ...schoolScopeFilter(user),
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { registrationNumber: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { middleName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.classId || query.academicYearId
        ? {
            enrolments: {
              some: {
                isActive: true,
                ...(query.classId ? { classId: query.classId } : {}),
                ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
              },
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.buildStudentProfileInclude(),
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items,
      meta: buildPageMeta(pagination.page, pagination.limit, total),
    };
  }

  async findById(id: string, user?: RequestUser): Promise<unknown> {
    const cacheKey = `student:${id}:profile`;
    const cached = await this.redis.get<{ schoolId?: string | null } | null>(cacheKey);
    if (cached) {
      assertSchoolInScope(user, cached.schoolId ?? null);
      return cached;
    }

    const student = await this.prisma.student.findUnique({
      where: { id },
      include: this.buildStudentProfileInclude(),
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // School isolation: a school-bound staff member cannot read a student
    // outside their school(s). Group roles and self/parent access pass through.
    assertSchoolInScope(user, (student as { schoolId?: string | null }).schoolId ?? null);

    await this.redis.set(cacheKey, student, 300);
    return student;
  }

  async findByRegistration(registrationNumber: string, user?: RequestUser): Promise<unknown> {
    const cacheKey = `student:reg:${registrationNumber}`;
    const cached = await this.redis.get<{ schoolId?: string | null } | null>(cacheKey);
    if (cached) {
      assertSchoolInScope(user, cached.schoolId ?? null);
      return cached;
    }

    const student = await this.prisma.student.findUnique({
      where: { registrationNumber },
      include: this.buildStudentProfileInclude(),
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    assertSchoolInScope(user, (student as { schoolId?: string | null }).schoolId ?? null);

    await this.redis.set(cacheKey, student, 300);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, user?: RequestUser): Promise<unknown> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }

    assertSchoolInScope(user, existing.schoolId ?? null);

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      },
      include: this.buildStudentProfileInclude(),
    });

    await this.redis.del(`student:${id}:profile`, `student:reg:${existing.registrationNumber}`);

    return updated;
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actorId: string): Promise<unknown> {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        status: dto.status,
        transferDate: dto.status === StudentStatus.TRANSFERRED ? effectiveDate : null,
        transferSchool: dto.transferSchool ?? null,
        graduationDate: dto.status === StudentStatus.GRADUATED ? effectiveDate : null,
        notes: dto.reason ? `${student.notes ?? ''}\n${dto.reason}`.trim() : student.notes,
      },
    });

    await this.rabbitMq.publish('student.status.changed', {
      studentId: id,
      previousStatus: student.status,
      newStatus: dto.status,
      reason: dto.reason,
      effectiveDate: effectiveDate.toISOString(),
      changedBy: actorId,
    });

    await this.redis.del(`student:${id}:profile`, `student:reg:${student.registrationNumber}`);

    return updated;
  }

  async promote(id: string, dto: PromoteStudentDto, actorId: string, user?: RequestUser): Promise<unknown> {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    assertSchoolInScope(user, student.schoolId);

    const activeEnrolment = await this.prisma.enrolment.findFirst({
      where: { studentId: id, isActive: true },
      include: { class: true },
      orderBy: { enrolledAt: 'desc' },
    });
    const fromClassId = dto.fromClassId ?? activeEnrolment?.classId;
    let targetClassId = dto.toClassId;
    let pathwayTransition: string | null = null;
    if (!targetClassId && fromClassId) {
      const pathway = await this.prisma.classPathway.findUnique({
        where: { fromClassId_academicYearId: { fromClassId, academicYearId: dto.academicYearId } },
        include: { toClass: true },
      });
      if (!pathway) {
        throw new BadRequestException('No class pathway configured for this promotion');
      }
      if (pathway.transitionType === 'GRADUATION' || pathway.transitionType === 'TRANSFER') {
        throw new BadRequestException(`Pathway resolves to ${pathway.transitionType}; use status workflow instead of class promotion`);
      }
      if (!pathway.toClassId) {
        throw new BadRequestException('Configured pathway has no target class');
      }
      targetClassId = pathway.toClassId;
      pathwayTransition = pathway.transitionType;
    }
    if (!targetClassId) {
      throw new BadRequestException('Provide toClassId or configure a class pathway');
    }

    const targetClass = await this.prisma.class.findUnique({ where: { id: targetClassId } });
    if (!targetClass) {
      throw new BadRequestException('Target class not found');
    }
    assertSchoolInScope(user, targetClass.schoolId);
    if (
      activeEnrolment?.class.educationStage !== targetClass.educationStage &&
      pathwayTransition !== 'CROSS_STAGE'
    ) {
      throw new BadRequestException('Cross-stage promotion requires an explicit CROSS_STAGE pathway');
    }

    const promotionTerm = await this.prisma.term.findFirst({
      where: { academicYearId: dto.academicYearId, isCurrent: true },
      select: { id: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      if (activeEnrolment) {
        await tx.enrolment.update({
          where: { id: activeEnrolment.id },
          data: { isActive: false, promotedAt: new Date() },
        });
      }

      const enrolment = await tx.enrolment.create({
        data: {
          studentId: id,
          classId: targetClassId,
          academicYearId: dto.academicYearId,
          termId: promotionTerm?.id ?? null,
          schoolId: targetClass.schoolId,
          isActive: true,
          promotedFrom: activeEnrolment?.classId,
          promotedAt: new Date(),
        },
      });

      // A cross-stage promotion physically moves the student to another school
      // (e.g. nursery → primary). Keep the student's home school in sync.
      if (targetClass.schoolId && targetClass.schoolId !== student.schoolId) {
        await tx.student.update({ where: { id }, data: { schoolId: targetClass.schoolId } });
      }

      return { enrolment, previousClassId: activeEnrolment?.classId ?? null };
    });

    await this.rabbitMq.publish('student.promoted', {
      studentId: id,
      toClassId: targetClassId,
      fromClassId: result.previousClassId,
      academicYearId: dto.academicYearId,
      pathwayTransition,
      promotedBy: actorId,
    });

    await this.redis.del(`student:${id}:profile`, `class:${targetClassId}:student-ids`);

    return result.enrolment;
  }

  async bulkPromote(dto: BulkPromoteStudentsDto, actorId: string, user?: RequestUser): Promise<unknown> {
    const pathway = await this.prisma.classPathway.findUnique({
      where: {
        fromClassId_academicYearId: {
          fromClassId: dto.fromClassId,
          academicYearId: dto.academicYearId,
        },
      },
      include: { fromClass: true, toClass: true },
    });
    if (!pathway) {
      throw new BadRequestException('No class pathway configured for source class');
    }
    resolveWriteSchoolId(user, pathway.fromClass.schoolId);
    if (pathway.toClass) assertSchoolInScope(user, pathway.toClass.schoolId);
    if (pathway.transitionType === 'GRADUATION' || pathway.transitionType === 'TRANSFER') {
      return {
        promoted: [],
        blocked: [],
        terminal: [{ fromClassId: dto.fromClassId, transitionType: pathway.transitionType, note: pathway.note }],
      };
    }
    if (!pathway.toClassId || !pathway.toClass) {
      throw new BadRequestException('Configured pathway has no target class');
    }
    if (pathway.fromClass.educationStage !== pathway.toClass.educationStage && pathway.transitionType !== 'CROSS_STAGE') {
      throw new BadRequestException('Cross-stage bulk promotion requires a CROSS_STAGE pathway');
    }

    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        classId: dto.fromClassId,
        academicYearId: dto.academicYearId,
        isActive: true,
        studentId: dto.studentIds?.length ? { in: dto.studentIds } : undefined,
      },
      include: { student: true },
      orderBy: { enrolledAt: 'asc' },
    });

    const promoted: Array<{ studentId: string; enrolmentId: string }> = [];
    const blocked: Array<{ studentId: string; reason: string }> = [];

    for (const enrolment of enrolments) {
      try {
        const created = await this.promote(
          enrolment.studentId,
          {
            fromClassId: dto.fromClassId,
            toClassId: pathway.toClassId,
            academicYearId: dto.targetAcademicYearId,
          },
          actorId,
          user,
        ) as { id: string; studentId: string };
        promoted.push({ studentId: created.studentId, enrolmentId: created.id });
      } catch (error) {
        blocked.push({
          studentId: enrolment.studentId,
          reason: error instanceof Error ? error.message : 'Promotion failed',
        });
      }
    }

    await this.rabbitMq.publish('students.bulk_promoted', {
      fromClassId: dto.fromClassId,
      toClassId: pathway.toClassId,
      academicYearId: dto.academicYearId,
      targetAcademicYearId: dto.targetAcademicYearId,
      promotedCount: promoted.length,
      blockedCount: blocked.length,
      promotedBy: actorId,
    });

    return { promoted, blocked, terminal: [] };
  }

  async getCurrentClassId(studentId: string): Promise<string | null> {
    const enrolment = await this.prisma.enrolment.findFirst({
      where: { studentId, isActive: true },
      orderBy: { enrolledAt: 'desc' },
      select: { classId: true },
    });

    return enrolment?.classId ?? null;
  }

  async logPrismaError(scope: string, error: unknown): Promise<void> {
    this.logger.error(`${scope} failed`, error as Error);
  }
}
