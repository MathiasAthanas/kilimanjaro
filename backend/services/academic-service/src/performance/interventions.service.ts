import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { UpdateInterventionDto } from './dto/update-intervention.dto';
import { ROLES } from '../common/constants/roles';
import { AccessControlService } from '../common/helpers/access-control.service';

@Injectable()
export class InterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  create(dto: CreateInterventionDto, user: RequestUser) {
    return this.prisma.academicIntervention.create({
      data: {
        ...dto,
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
  }) {
    return this.prisma.academicIntervention.findMany({
      where: {
        studentId: filters.studentId,
        type: filters.type as any,
        performedById: filters.performedById,
        subjectId: filters.subjectId,
        isFollowedUp: filters.isFollowedUp === undefined ? undefined : filters.isFollowedUp === 'true',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, dto: UpdateInterventionDto) {
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
      where: { studentId },
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
