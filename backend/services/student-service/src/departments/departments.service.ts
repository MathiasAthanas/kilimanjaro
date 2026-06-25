import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
      await this.prisma.department.upsert({
        where: { code: dept.code },
        create: dept,
        update: { name: dept.name, isSystemDefault: dept.isSystemDefault },
      });
    }
  }

  async create(dto: CreateDepartmentDto) {
    try {
      return await this.prisma.department.create({ data: dto });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('A department with that name or code already exists');
      }
      throw err;
    }
  }

  async list() {
    return this.prisma.department.findMany({
      orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }],
      include: {
        hodAssignments: {
          where: { isActive: true },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async update(id: string, dto: Partial<CreateDepartmentDto>) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    try {
      return await this.prisma.department.update({ where: { id }, data: dto });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('A department with that name or code already exists');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    if (existing.isSystemDefault) {
      throw new BadRequestException('System default departments cannot be deleted');
    }
    const activeHods = await this.prisma.departmentHod.count({ where: { departmentId: id, isActive: true } });
    if (activeHods > 0) {
      throw new BadRequestException('Remove active HOD assignments before deleting this department');
    }
    await this.prisma.department.delete({ where: { id } });
  }

  async assignHod(departmentId: string, dto: AssignHodDto) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');

    const existing = await this.prisma.departmentHod.findFirst({
      where: { departmentId, userId: dto.userId, academicYearId: dto.academicYearId },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException('This user is already an active HOD for this department in this year');
      return this.prisma.departmentHod.update({
        where: { id: existing.id },
        data: { isActive: true, removedAt: null, firstName: dto.firstName, lastName: dto.lastName },
      });
    }

    return this.prisma.departmentHod.create({ data: { departmentId, ...dto } });
  }

  async removeHod(departmentId: string, userId: string, academicYearId: string): Promise<void> {
    const existing = await this.prisma.departmentHod.findFirst({
      where: { departmentId, userId, academicYearId, isActive: true },
    });
    if (!existing) throw new NotFoundException('Active HOD assignment not found');
    await this.prisma.departmentHod.update({
      where: { id: existing.id },
      data: { isActive: false, removedAt: new Date() },
    });
  }

  async listHods(departmentId: string, academicYearId?: string) {
    return this.prisma.departmentHod.findMany({
      where: {
        departmentId,
        academicYearId: academicYearId ?? undefined,
      },
      orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }],
    });
  }

  async getDepartmentByUserId(userId: string, academicYearId?: string) {
    const hod = await this.prisma.departmentHod.findFirst({
      where: { userId, isActive: true, academicYearId: academicYearId ?? undefined },
      include: { department: true },
      orderBy: { assignedAt: 'desc' },
    });
    return hod?.department ?? null;
  }
}
