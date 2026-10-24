import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, DisciplineCategory, DisciplineSeverity } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter, assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { ResolveDisciplineDto } from './dto/resolve-discipline.dto';

@Injectable()
export class DisciplineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async create(dto: CreateDisciplineDto, reportedById: string): Promise<unknown> {
    const record = await this.prisma.disciplineRecord.create({
      data: {
        studentId: dto.studentId,
        incidentDate: new Date(dto.incidentDate),
        category: dto.category,
        severity: dto.severity,
        description: dto.description,
        actionTaken: dto.actionTaken,
        reportedById,
        requiresParentNotification: dto.requiresParentNotification ?? true,
      },
    });

    await this.rabbitMq.publish('discipline.recorded', {
      recordId: record.id,
      studentId: record.studentId,
      category: record.category,
      severity: record.severity,
      requiresParentNotification: record.requiresParentNotification,
    });

    return record;
  }

  async list(
    query: {
      studentId?: string;
      category?: DisciplineCategory;
      severity?: DisciplineSeverity;
      startDate?: string;
      endDate?: string;
      reportedByMe?: boolean;
    },
    user?: RequestUser,
  ): Promise<unknown> {
    // DisciplineRecord has no schoolId column — scope through the student's school.
    // Honours an active school for group users too (not just SCHOOL-scoped staff).
    const scope = schoolScopeFilter(user);
    const schoolFilter: Prisma.DisciplineRecordWhereInput = scope.schoolId
      ? { student: { schoolId: scope.schoolId as any } }
      : {};

    const where: Prisma.DisciplineRecordWhereInput = {
      ...schoolFilter,
      studentId: query.studentId,
      category: query.category,
      severity: query.severity,
      // TEACHER can only see records they reported
      ...(user?.role === 'TEACHER' || query.reportedByMe ? { reportedById: user?.id } : {}),
      incidentDate: {
        gte: query.startDate ? new Date(query.startDate) : undefined,
        lte: query.endDate ? new Date(query.endDate) : undefined,
      },
    };

    return this.prisma.disciplineRecord.findMany({
      where,
      include: { student: true },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async studentRecords(studentId: string, currentUser?: RequestUser): Promise<unknown> {
    if (currentUser?.role === 'PARENT') {
      const link = await this.prisma.studentGuardianLink.findFirst({
        where: { studentId, isActive: true, guardian: { authUserId: currentUser.id } },
      });
      if (!link) throw new ForbiddenException('Parent access denied');
    } else if (currentUser?.role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({ where: { id: studentId } });
      if (!student || student.authUserId !== currentUser.id) {
        throw new ForbiddenException('Student access denied');
      }
    } else if (currentUser?.scope === 'SCHOOL') {
      // Staff with school scope must only access students within their school(s).
      const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
      const allowed = currentUser.schoolIds?.some((id) => id === '*' || id === student?.schoolId);
      if (!allowed) throw new ForbiddenException('Student is not in your school');
    }

    return this.prisma.disciplineRecord.findMany({
      where: { studentId },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async resolve(recordId: string, dto: ResolveDisciplineDto, user?: RequestUser): Promise<unknown> {
    const existing = await this.prisma.disciplineRecord.findUnique({
      where: { id: recordId },
      include: { student: { select: { schoolId: true } } },
    });
    if (!existing) throw new ForbiddenException('Discipline record not found');
    assertSchoolInScope(user, existing.student?.schoolId ?? null);

    return this.prisma.disciplineRecord.update({
      where: { id: recordId },
      data: {
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : new Date(),
        resolutionNote: dto.resolutionNote,
      },
    });
  }
}
