import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, DisciplineCategory, DisciplineSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
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
    });

    return record;
  }

  async list(query: {
    studentId?: string;
    category?: DisciplineCategory;
    severity?: DisciplineSeverity;
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {
    const where: Prisma.DisciplineRecordWhereInput = {
      studentId: query.studentId,
      category: query.category,
      severity: query.severity,
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

  async studentRecords(studentId: string, currentUser?: { id: string; role: string }): Promise<unknown> {
    if (currentUser?.role === 'PARENT') {
      const link = await this.prisma.studentGuardianLink.findFirst({
        where: {
          studentId,
          isActive: true,
          guardian: { authUserId: currentUser.id },
        },
      });
      if (!link) {
        throw new ForbiddenException('Parent access denied');
      }
    }

    if (currentUser?.role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({ where: { id: studentId } });
      if (!student || student.authUserId !== currentUser.id) {
        throw new ForbiddenException('Student access denied');
      }
    }

    return this.prisma.disciplineRecord.findMany({
      where: { studentId },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async resolve(recordId: string, dto: ResolveDisciplineDto): Promise<unknown> {
    return this.prisma.disciplineRecord.update({
      where: { id: recordId },
      data: {
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : new Date(),
        resolutionNote: dto.resolutionNote,
      },
    });
  }
}