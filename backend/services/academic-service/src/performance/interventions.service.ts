import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { UpdateInterventionDto } from './dto/update-intervention.dto';
import { ROLES } from '../common/constants/roles';
import { AccessControlService } from '../common/helpers/access-control.service';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';

@Injectable()
export class InterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  create(dto: CreateInterventionDto, user: RequestUser) {
    // A teacher in several schools names the student's school; it must be one of theirs.
    if (dto.schoolId) assertSchoolInScope(user, dto.schoolId);
    const schoolId = dto.schoolId ?? (user.scope === 'SCHOOL' ? (user.activeSchoolId ?? user.schoolIds?.[0] ?? null) : null);
    return this.prisma.academicIntervention.create({
      data: {
        ...dto,
        schoolId,
        performedById: user.id,
        performedByRole: user.role,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });
  }

  list(filters: {
    studentId?: string;
    type?: string;
    performedById?: string;
    isFollowedUp?: string;
    subjectId?: string;
    schoolId?: string | null;
  }) {
    return this.prisma.academicIntervention.findMany({
      where: {
        studentId: filters.studentId,
        type: filters.type as any,
        performedById: filters.performedById,
        subjectId: filters.subjectId,
        isFollowedUp: filters.isFollowedUp === undefined ? undefined : filters.isFollowedUp === 'true',
        ...(filters.schoolId ? { schoolId: filters.schoolId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The caller's own interventions (a teacher's follow-up list), within their schools. */
  mine(user: RequestUser) {
    return this.prisma.academicIntervention.findMany({
      where: { performedById: user.id, ...schoolScopeFilter(user) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async update(id: string, dto: UpdateInterventionDto, user?: RequestUser) {
    const row = await this.prisma.academicIntervention.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Intervention not found');
    if (user) {
      assertSchoolInScope(user, row.schoolId ?? undefined);
      // Teachers and heads of department only change interventions they recorded themselves.
      if ([ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT].includes(user.role as any) && row.performedById !== user.id) {
        throw new ForbiddenException('You can only update interventions you recorded');
      }
    }
    return this.prisma.academicIntervention.update({
      where: { id },
      data: {
        ...dto,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });
  }

  async byStudent(studentId: string, user?: RequestUser) {
    if (user?.role === ROLES.PARENT) {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user?.role === ROLES.STUDENT) {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }

    const items = await this.prisma.academicIntervention.findMany({
      // Parents/students are authorised by ownership above; staff are limited to their schools.
      where: { studentId, ...([ROLES.PARENT, ROLES.STUDENT].includes(user?.role as any) ? {} : schoolScopeFilter(user)) },
      orderBy: { createdAt: 'desc' },
    });

    if ([ROLES.PARENT, ROLES.STUDENT].includes(user?.role as any)) {
      return items.map((item) => ({
        id: item.id,
        studentId: item.studentId,
        subjectName: item.subjectName,
        type: item.type,
        outcome: item.outcome,
        followUpDate: item.followUpDate,
        isFollowedUp: item.isFollowedUp,
        createdAt: item.createdAt,
      }));
    }

    return items;
  }
}
