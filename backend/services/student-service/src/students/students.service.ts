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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { paginate, buildPageMeta } from '../common/helpers/pagination.helper';
import { formatRegistrationNumber } from '../common/helpers/registration-number.helper';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly redis: RedisService,
  ) {}

  private async generateRegistrationNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
    const year = date.getUTCFullYear();

    const sequence = await tx.registrationSequence.upsert({
      where: { year },
      create: { year, nextValue: 2 },
      update: {
        nextValue: {
          increment: 1,
        },
      },
      select: {
        nextValue: true,
      },
    });

    const nextValue = sequence.nextValue - 1;
    return formatRegistrationNumber(year, nextValue);
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

  async create(dto: CreateStudentDto, actorId: string): Promise<unknown> {
    const admissionDate = new Date(dto.admissionDate);

    const created = await this.prisma.$transaction(async (tx) => {
      const classExists = await tx.class.findUnique({ where: { id: dto.classId } });
      if (!classExists) {
        throw new BadRequestException('Class not found');
      }

      const academicYear = await tx.academicYear.findUnique({ where: { id: dto.academicYearId } });
      if (!academicYear) {
        throw new BadRequestException('Academic year not found');
      }

      const registrationNumber = await this.generateRegistrationNumber(tx, admissionDate);

      const student = await tx.student.create({
        data: {
          registrationNumber,
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

  async list(query: ListStudentsDto): Promise<unknown> {
    const pagination = paginate(query.page, query.limit);

    const where: Prisma.StudentWhereInput = {
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

  async findById(id: string): Promise<unknown> {
    const cacheKey = `student:${id}:profile`;
    const cached = await this.redis.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const student = await this.prisma.student.findUnique({
      where: { id },
      include: this.buildStudentProfileInclude(),
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.redis.set(cacheKey, student, 300);
    return student;
  }

  async findByRegistration(registrationNumber: string): Promise<unknown> {
    const cacheKey = `student:reg:${registrationNumber}`;
    const cached = await this.redis.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const student = await this.prisma.student.findUnique({
      where: { registrationNumber },
      include: this.buildStudentProfileInclude(),
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.redis.set(cacheKey, student, 300);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<unknown> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }

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

  async promote(id: string, dto: PromoteStudentDto, actorId: string): Promise<unknown> {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const targetClass = await this.prisma.class.findUnique({ where: { id: dto.toClassId } });
    if (!targetClass) {
      throw new BadRequestException('Target class not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const activeEnrolment = await tx.enrolment.findFirst({
        where: { studentId: id, isActive: true },
        orderBy: { enrolledAt: 'desc' },
      });

      if (activeEnrolment) {
        await tx.enrolment.update({
          where: { id: activeEnrolment.id },
          data: { isActive: false, promotedAt: new Date() },
        });
      }

      const enrolment = await tx.enrolment.create({
        data: {
          studentId: id,
          classId: dto.toClassId,
          academicYearId: dto.academicYearId,
          isActive: true,
          promotedFrom: activeEnrolment?.classId,
          promotedAt: new Date(),
        },
      });

      return { enrolment, previousClassId: activeEnrolment?.classId ?? null };
    });

    await this.rabbitMq.publish('student.promoted', {
      studentId: id,
      toClassId: dto.toClassId,
      fromClassId: result.previousClassId,
      academicYearId: dto.academicYearId,
      promotedBy: actorId,
    });

    await this.redis.del(`student:${id}:profile`, `class:${dto.toClassId}:student-ids`);

    return result.enrolment;
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
