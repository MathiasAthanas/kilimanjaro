import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async createClass(dto: CreateClassDto): Promise<unknown> {
    return this.prisma.class.create({
      data: {
        name: dto.name,
        level: dto.level,
        stream: dto.stream,
        academicYearId: dto.academicYearId,
        classTeacherId: dto.classTeacherId,
        capacity: dto.capacity ?? 40,
      },
    });
  }

  async listClasses(filters: { academicYearId?: string; level?: number; stream?: string }): Promise<unknown> {
    return this.prisma.class.findMany({
      where: {
        academicYearId: filters.academicYearId,
        level: filters.level,
        stream: filters.stream,
      },
      include: {
        academicYear: true,
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }, { stream: 'asc' }],
    });
  }

  async classStudents(classId: string): Promise<unknown> {
    return this.prisma.enrolment.findMany({
      where: { classId, isActive: true },
      include: {
        student: true,
        class: true,
        academicYear: true,
        term: true,
      },
      orderBy: { enrolledAt: 'asc' },
    });
  }

  async createAcademicYear(dto: CreateAcademicYearDto): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.academicYear.updateMany({ data: { isCurrent: false } });
      }

      return tx.academicYear.create({
        data: {
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isCurrent: Boolean(dto.isCurrent),
        },
      });
    });
  }

  async listAcademicYears(): Promise<unknown> {
    return this.prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async createTerm(dto: CreateTermDto): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.term.updateMany({
          where: { academicYearId: dto.academicYearId },
          data: { isCurrent: false },
        });
      }

      return tx.term.create({
        data: {
          academicYearId: dto.academicYearId,
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isCurrent: Boolean(dto.isCurrent),
        },
      });
    });
  }

  async listTerms(filters: { academicYearId?: string; isCurrent?: boolean }): Promise<unknown> {
    return this.prisma.term.findMany({
      where: {
        academicYearId: filters.academicYearId,
        ...(typeof filters.isCurrent === 'boolean' ? { isCurrent: filters.isCurrent } : {}),
      },
      orderBy: [{ academicYear: { startDate: 'desc' } }, { startDate: 'asc' }],
    });
  }
}