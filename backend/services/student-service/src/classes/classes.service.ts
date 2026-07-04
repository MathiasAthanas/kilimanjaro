import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateClassPathwayDto } from './dto/create-class-pathway.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateTermDto } from './dto/create-term.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateClassShape(dto: { educationStage?: string | null; level: number; terminalYear?: boolean; name: string }): void {
    const stage = dto.educationStage ?? 'O_LEVEL';
    if ((stage === 'NURSERY' || stage === 'PRE_UNIT') && dto.level !== 1) {
      throw new BadRequestException(`${dto.name} must use level 1 for Nursery and Pre-Unit`);
    }
    if (stage === 'PRIMARY' && (dto.level < 1 || dto.level > 7)) {
      throw new BadRequestException('Primary class level must be between 1 and 7');
    }
    if (stage === 'O_LEVEL' && (dto.level < 1 || dto.level > 4)) {
      throw new BadRequestException('O-Level class level must be between Form 1 and Form 4');
    }
    if (stage === 'A_LEVEL' && ![5, 6].includes(dto.level)) {
      throw new BadRequestException('A-Level class level must be Form 5 or Form 6');
    }
    if ((stage === 'PRE_UNIT' && dto.level === 1) || (stage === 'O_LEVEL' && dto.level === 4) || (stage === 'A_LEVEL' && dto.level === 6)) {
      if (dto.terminalYear === false) {
        throw new BadRequestException(`${dto.name} must be marked as a terminal year class`);
      }
    }
  }

  async createClass(dto: CreateClassDto): Promise<unknown> {
    this.validateClassShape(dto);
    return this.prisma.class.create({
      data: {
        name: dto.name,
        level: dto.level,
        stream: dto.stream,
        educationStage: dto.educationStage ?? 'O_LEVEL',
        curriculumCode: dto.curriculumCode,
        terminalYear: dto.terminalYear ?? false,
        sortOrder: dto.sortOrder,
        academicYearId: dto.academicYearId,
        classTeacherId: dto.classTeacherId,
        capacity: dto.capacity ?? 40,
      },
    });
  }

  async updateClass(id: string, dto: Partial<CreateClassDto>): Promise<unknown> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found');
    }
    const merged = {
      ...existing,
      ...dto,
      educationStage: dto.educationStage ?? existing.educationStage,
      terminalYear: dto.terminalYear ?? existing.terminalYear,
    };
    this.validateClassShape(merged);
    return this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name,
        level: dto.level,
        stream: dto.stream,
        educationStage: dto.educationStage,
        curriculumCode: dto.curriculumCode,
        terminalYear: dto.terminalYear,
        sortOrder: dto.sortOrder,
        academicYearId: dto.academicYearId,
        classTeacherId: dto.classTeacherId,
        capacity: dto.capacity,
      },
      include: { academicYear: true, pathwayFrom: { include: { toClass: true } } },
    });
  }

  async listClasses(filters: { academicYearId?: string; level?: number; stream?: string; educationStage?: string }): Promise<unknown> {
    return this.prisma.class.findMany({
      where: {
        academicYearId: filters.academicYearId,
        level: filters.level,
        stream: filters.stream,
        educationStage: filters.educationStage as any,
      },
      include: {
        academicYear: true,
        pathwayFrom: { include: { toClass: true } },
      },
      orderBy: [{ educationStage: 'asc' }, { sortOrder: 'asc' }, { level: 'asc' }, { name: 'asc' }, { stream: 'asc' }],
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

  async createClassPathway(dto: CreateClassPathwayDto): Promise<unknown> {
    return this.prisma.classPathway.upsert({
      where: {
        fromClassId_academicYearId: {
          fromClassId: dto.fromClassId,
          academicYearId: dto.academicYearId,
        },
      },
      create: {
        fromClassId: dto.fromClassId,
        toClassId: dto.toClassId,
        academicYearId: dto.academicYearId,
        transitionType: dto.transitionType ?? 'PROMOTION',
        note: dto.note,
      },
      update: {
        toClassId: dto.toClassId,
        transitionType: dto.transitionType ?? 'PROMOTION',
        note: dto.note,
      },
      include: { fromClass: true, toClass: true, academicYear: true },
    });
  }

  async listClassPathways(filters: { academicYearId?: string; transitionType?: string }): Promise<unknown> {
    return this.prisma.classPathway.findMany({
      where: {
        academicYearId: filters.academicYearId,
        transitionType: filters.transitionType as any,
      },
      include: { fromClass: true, toClass: true, academicYear: true },
      orderBy: [{ academicYear: { startDate: 'desc' } }, { fromClass: { sortOrder: 'asc' } }],
    });
  }

  async resolveNextClass(fromClassId: string, academicYearId: string): Promise<unknown> {
    const pathway = await this.prisma.classPathway.findUnique({
      where: { fromClassId_academicYearId: { fromClassId, academicYearId } },
      include: { fromClass: true, toClass: true, academicYear: true },
    });
    if (!pathway) {
      throw new NotFoundException('No class pathway configured for this class and academic year');
    }
    return pathway;
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

  async deleteClass(id: string): Promise<void> {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');

    const [activeEnrolments, totalEnrolments] = await Promise.all([
      this.prisma.enrolment.count({ where: { classId: id, isActive: true } }),
      this.prisma.enrolment.count({ where: { classId: id } }),
    ]);

    if (activeEnrolments > 0) {
      throw new BadRequestException(
        `Cannot delete "${cls.name}" — ${activeEnrolments} student${activeEnrolments > 1 ? 's are' : ' is'} currently enrolled. Unenrol them first.`,
      );
    }
    if (totalEnrolments > 0) {
      throw new BadRequestException(
        `Cannot delete "${cls.name}" — it has ${totalEnrolments} historical enrolment record${totalEnrolments > 1 ? 's' : ''} linked to it.`,
      );
    }

    await this.prisma.class.delete({ where: { id } });
  }

  async deleteAcademicYear(id: string): Promise<void> {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.isCurrent) {
      throw new BadRequestException('Cannot delete the current academic year — set another year as current first.');
    }

    const [termCount, classCount, enrolmentCount] = await Promise.all([
      this.prisma.term.count({ where: { academicYearId: id } }),
      this.prisma.class.count({ where: { academicYearId: id } }),
      this.prisma.enrolment.count({ where: { academicYearId: id } }),
    ]);

    const blockers: string[] = [];
    if (termCount > 0) blockers.push(`${termCount} term${termCount > 1 ? 's' : ''}`);
    if (classCount > 0) blockers.push(`${classCount} class${classCount > 1 ? 'es' : ''}`);
    if (enrolmentCount > 0) blockers.push(`${enrolmentCount} enrolment${enrolmentCount > 1 ? 's' : ''}`);

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete "${year.name}" — it has ${blockers.join(', ')} linked to it. Remove them first.`,
      );
    }

    await this.prisma.academicYear.delete({ where: { id } });
  }

  async deleteTerm(id: string): Promise<void> {
    const term = await this.prisma.term.findUnique({ where: { id }, include: { academicYear: true } });
    if (!term) throw new NotFoundException('Term not found');
    if (term.isCurrent) {
      throw new BadRequestException('Cannot delete the current term — set another term as current first.');
    }

    const [enrolmentCount, attendanceCount] = await Promise.all([
      this.prisma.enrolment.count({ where: { termId: id } }),
      this.prisma.attendanceRecord.count({ where: { termId: id } }),
    ]);

    const blockers: string[] = [];
    if (enrolmentCount > 0) blockers.push(`${enrolmentCount} enrolment${enrolmentCount > 1 ? 's' : ''}`);
    if (attendanceCount > 0) blockers.push(`${attendanceCount} attendance record${attendanceCount > 1 ? 's' : ''}`);

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete "${term.name}" — it has ${blockers.join(', ')} linked to it.`,
      );
    }

    await this.prisma.term.delete({ where: { id } });
  }
}
