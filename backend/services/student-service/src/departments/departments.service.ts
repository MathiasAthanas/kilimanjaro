import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  assertSchoolAccessible,
  assertSchoolRecordWritable,
  requireWriteSchoolId,
  schoolOrGlobalFilter,
  schoolScopeFilter,
} from '../common/helpers/school-scope.helper';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { AssignHodDto } from './dto/assign-hod.dto';

const SYSTEM_DEFAULTS = [
  { name: 'Science', code: 'SCI', isSystemDefault: false },
  { name: 'Mathematics', code: 'MATH', isSystemDefault: false },
  { name: 'Languages', code: 'LANG', isSystemDefault: false },
  { name: 'Humanities', code: 'HUM', isSystemDefault: false },
  { name: 'Business', code: 'BUS', isSystemDefault: false },
  { name: 'ICT', code: 'ICT', isSystemDefault: false },
  { name: 'Primary', code: 'PRI', isSystemDefault: false },
  { name: 'Discipline', code: 'DISC', isSystemDefault: true },
] as const;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async seedSystemDefaults(): Promise<void> {
    for (const dept of SYSTEM_DEFAULTS) {
      const existing = await this.prisma.department.findFirst({
        where: { schoolId: null, code: dept.code },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.department.update({
          where: { id: existing.id },
          data: { name: dept.name, isSystemDefault: dept.isSystemDefault },
        });
      } else {
        await this.prisma.department.create({ data: { ...dept, schoolId: null } });
      }
    }
  }

  async create(dto: CreateDepartmentDto, user?: RequestUser) {
    try {
      return await this.prisma.department.create({
        data: { ...dto, schoolId: requireWriteSchoolId(user, 'department') },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('A department with that name or code already exists for this school');
      }
      throw err;
    }
  }

  async list(user?: RequestUser) {
    return this.prisma.department.findMany({
      where: { ...schoolOrGlobalFilter(user) },
      orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }],
      include: {
        hodAssignments: {
          where: { isActive: true, ...schoolScopeFilter(user) },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async update(id: string, dto: Partial<CreateDepartmentDto>, user?: RequestUser) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    assertSchoolRecordWritable(user, existing.schoolId ?? null, 'department');
    try {
      return await this.prisma.department.update({ where: { id }, data: dto });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('A department with that name or code already exists for this school');
      }
      throw err;
    }
  }

  async remove(id: string, user?: RequestUser): Promise<void> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    assertSchoolRecordWritable(user, existing.schoolId ?? null, 'department');
    if (existing.isSystemDefault) {
      throw new BadRequestException('System default departments cannot be deleted');
    }
    const activeHods = await this.prisma.departmentHod.count({ where: { departmentId: id, isActive: true } });
    if (activeHods > 0) {
      throw new BadRequestException('Remove active HOD assignments before deleting this department');
    }
    await this.prisma.department.delete({ where: { id } });
  }

  async assignHod(departmentId: string, dto: AssignHodDto, user?: RequestUser) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');
    assertSchoolRecordWritable(user, dept.schoolId ?? null, 'department');
    if (!dept.schoolId) {
      throw new BadRequestException('Create a school-specific department before assigning its HOD');
    }

    const existing = await this.prisma.departmentHod.findFirst({
      where: { departmentId, userId: dto.userId, academicYearId: dto.academicYearId },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException('This user is already an active HOD for this department in this year');
      return this.prisma.departmentHod.update({
        where: { id: existing.id },
        data: { isActive: true, removedAt: null, firstName: dto.firstName, lastName: dto.lastName, schoolId: dept.schoolId },
      });
    }

    return this.prisma.departmentHod.create({ data: { departmentId, schoolId: dept.schoolId, ...dto } });
  }

  async removeHod(departmentId: string, userId: string, academicYearId: string, user?: RequestUser): Promise<void> {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');
    assertSchoolRecordWritable(user, dept.schoolId ?? null, 'department');
    const existing = await this.prisma.departmentHod.findFirst({
      where: { departmentId, userId, academicYearId, isActive: true },
    });
    if (!existing) throw new NotFoundException('Active HOD assignment not found');
    await this.prisma.departmentHod.update({
      where: { id: existing.id },
      data: { isActive: false, removedAt: new Date() },
    });
  }

  async listHods(departmentId: string, academicYearId?: string, user?: RequestUser) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new NotFoundException('Department not found');
    assertSchoolAccessible(user, department.schoolId ?? null);
    if (!department.schoolId && user && user.scope === 'SCHOOL') return [];

    return this.prisma.departmentHod.findMany({
      where: {
        departmentId,
        ...schoolScopeFilter(user),
        academicYearId: academicYearId ?? undefined,
      },
      orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }],
    });
  }

  async getDepartmentByUserId(userId: string, academicYearId?: string, user?: RequestUser) {
    const hod = await this.prisma.departmentHod.findFirst({
      where: {
        userId,
        isActive: true,
        academicYearId: academicYearId ?? undefined,
        ...schoolScopeFilter(user),
      },
      include: { department: true },
      orderBy: { assignedAt: 'desc' },
    });
    return hod?.department ?? null;
  }
}
