import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
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

  async listSubjects(filters: { isActive?: string; isCompulsory?: string }) {
    const cacheKey = 'subjects:all';
    if (!filters.isActive && !filters.isCompulsory) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const subjects = await this.prisma.subject.findMany({
      where: {
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
        isCompulsory: filters.isCompulsory === undefined ? undefined : filters.isCompulsory === 'true',
      },
      orderBy: { name: 'asc' },
    });

    if (!filters.isActive && !filters.isCompulsory) {
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
    return this.prisma.classSubject.create({ data: dto });
  }

  async listClassSubjects(filters: {
    classId?: string;
    academicYearId?: string;
    teacherId?: string;
    subjectId?: string;
  }) {
    return this.prisma.classSubject.findMany({
      where: {
        classId: filters.classId,
        academicYearId: filters.academicYearId,
        teacherId: filters.teacherId,
        subjectId: filters.subjectId,
      },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClassSubject(id: string, dto: UpdateClassSubjectDto) {
    const existing = await this.prisma.classSubject.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class subject not found');
    }

    return this.prisma.classSubject.update({ where: { id }, data: dto });
  }
}
