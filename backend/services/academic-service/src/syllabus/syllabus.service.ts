import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { CreateSyllabusDto } from './dto/create-syllabus.dto';
import { UpdateSyllabusDto } from './dto/update-syllabus.dto';

@Injectable()
export class SyllabusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSyllabusDto, user: RequestUser) {
    const classSubject = await this.prisma.classSubject.findUnique({ where: { id: dto.classSubjectId } });
    if (!classSubject) {
      throw new NotFoundException('Class subject not found');
    }

    if (user.role === ROLES.TEACHER && classSubject.teacherId !== user.id) {
      throw new NotFoundException('Class subject not found in your scope');
    }

    const completion = 0;
    return this.prisma.syllabusTracker.upsert({
      where: { classSubjectId_termId: { classSubjectId: dto.classSubjectId, termId: dto.termId } },
      create: {
        classSubjectId: dto.classSubjectId,
        termId: dto.termId,
        totalTopics: dto.totalTopics,
        coveredTopics: 0,
        completionPercentage: completion,
        lastUpdatedById: user.id,
      },
      update: {
        totalTopics: dto.totalTopics,
        completionPercentage: completion,
        lastUpdatedById: user.id,
      },
    });
  }

  async update(id: string, dto: UpdateSyllabusDto, user: RequestUser) {
    const existing = await this.prisma.syllabusTracker.findUnique({
      where: { id },
      include: { classSubject: true },
    });

    if (!existing) {
      throw new NotFoundException('Syllabus tracker not found');
    }

    if (user.role === ROLES.TEACHER && existing.classSubject.teacherId !== user.id) {
      throw new NotFoundException('Syllabus tracker not found in your scope');
    }

    const completion = Number(((dto.coveredTopics / existing.totalTopics) * 100).toFixed(2));

    return this.prisma.syllabusTracker.update({
      where: { id },
      data: {
        coveredTopics: dto.coveredTopics,
        notes: dto.notes,
        completionPercentage: completion,
        lastUpdatedById: user.id,
      },
      include: {
        classSubject: {
          include: { subject: true },
        },
      },
    });
  }

  list(filters: { classId?: string; termId?: string; teacherId?: string; subjectId?: string }) {
    return this.prisma.syllabusTracker.findMany({
      where: {
        termId: filters.termId,
        classSubject: {
          classId: filters.classId,
          teacherId: filters.teacherId,
          subjectId: filters.subjectId,
        },
      },
      include: {
        classSubject: {
          include: { subject: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
