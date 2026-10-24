import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DepartmentsService } from '../departments/departments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('Internal')
@Controller('students/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly departments: DepartmentsService,
  ) {}

  @Get('by-auth/:authUserId')
  @ApiOperation({ summary: 'Get student mapping by auth user id' })
  async byAuth(@Param('authUserId') authUserId: string) {
    const student = await this.prisma.student.findUnique({
      where: { authUserId },
      include: {
        enrolments: {
          where: { isActive: true },
          orderBy: { enrolledAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      return null;
    }

    return {
      studentId: student.id,
      registrationNumber: student.registrationNumber,
      classId: student.enrolments[0]?.classId ?? null,
      status: student.status,
    };
  }

  @Get('schools')
  @ApiOperation({ summary: 'School id, code and name for every school (used to prefix document numbers)' })
  async schools() {
    return this.prisma.school.findMany({ select: { id: true, code: true, name: true, motto: true, address: true, phone: true, email: true }, orderBy: { name: 'asc' } });
  }

  @Get('terms')
  @ApiOperation({ summary: 'Every term with its academic year (used to label invoices and receipts)' })
  async terms() {
    const rows = await this.prisma.term.findMany({
      select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true, academicYear: { select: { id: true, name: true } } },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((t) => ({ id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, isCurrent: t.isCurrent, academicYearId: t.academicYear?.id ?? null, academicYearName: t.academicYear?.name ?? null }));
  }

  @Get('search')
  @ApiOperation({ summary: 'Student ids whose name or registration number match the text (every word must match)' })
  async search(@Query('q') q?: string, @Query('limit') limit?: string) {
    const words = String(q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 4);
    if (!words.length) return [];
    const rows = await this.prisma.student.findMany({
      where: {
        AND: words.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: 'insensitive' as const } },
            { middleName: { contains: word, mode: 'insensitive' as const } },
            { lastName: { contains: word, mode: 'insensitive' as const } },
            { registrationNumber: { contains: word, mode: 'insensitive' as const } },
          ],
        })),
      },
      select: { id: true },
      take: Math.min(500, Math.max(1, Number(limit) || 300)),
    });
    return rows.map((r) => r.id);
  }

  @Get('by-ids')
  @ApiOperation({ summary: 'Resolve display details for a list of student ids' })
  async byIds(@Query('ids') ids?: string) {
    const list = String(ids ?? '').split(',').map((id) => id.trim()).filter(Boolean).slice(0, 500);
    if (!list.length) return [];
    const students = await this.prisma.student.findMany({
      where: { id: { in: list } },
      select: {
        id: true,
        authUserId: true,
        schoolId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        registrationNumber: true,
        enrolments: { where: { isActive: true }, orderBy: { enrolledAt: 'desc' }, take: 1, select: { classId: true, class: { select: { name: true } } } },
      },
    });
    return students.map(({ enrolments, ...s }) => ({
      ...s,
      name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '),
      classId: enrolments[0]?.classId ?? null,
      className: enrolments[0]?.class?.name ?? null,
    }));
  }

  @Get('guardian-by-auth/:authUserId')
  @ApiOperation({ summary: 'List a guardian\'s children (by guardian auth user id)' })
  async guardianByAuth(@Param('authUserId') authUserId: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { authUserId },
      include: {
        studentLinks: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                enrolments: {
                  where: { isActive: true },
                  orderBy: { enrolledAt: 'desc' },
                  take: 1,
                  include: { class: true, academicYear: true },
                },
              },
            },
          },
        },
      },
    });

    if (!guardian) {
      return [];
    }

    // Shaped for the mobile parent flow: one summary per child, ready for
    // the per-child dashboard fetch that follows.
    return guardian.studentLinks.map((link) => {
      const student = link.student;
      const enrolment = student.enrolments[0];
      const cls = enrolment?.class;
      return {
        id: student.id,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        registrationNumber: student.registrationNumber,
        status: student.status,
        classId: cls?.id ?? null,
        classLabel: cls ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : null,
        educationStage: cls?.educationStage ?? null,
        academicYear: enrolment?.academicYear?.name ?? null,
        guardianId: guardian.id,
      };
    });
  }

  @Get('departments/by-user/:userId')
  @ApiOperation({ summary: 'Get department assigned to a HOD user' })
  async departmentByUser(
    @Param('userId') userId: string,
    @Query('academicYearId') academicYearId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.departments.getDepartmentByUserId(userId, academicYearId, user);
  }

  @Get('class/:classId/student-ids')
  @ApiOperation({ summary: 'Get active class student ids' })
  async classStudentIds(@Param('classId') classId: string) {
    const cacheKey = `class:${classId}:student-ids`;
    const cached = await this.redis.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const enrolments = await this.prisma.enrolment.findMany({
      where: { classId, isActive: true },
      select: { studentId: true },
    });

    const ids = enrolments.map((item) => item.studentId);
    await this.redis.set(cacheKey, ids, 600);
    return ids;
  }

  @Get('students-school-scope')
  @ApiOperation({ summary: 'Resolve school ownership for student ids' })
  async studentsSchoolScope(@Query('studentIds') studentIds?: string) {
    const ids = (studentIds || '').split(',').map((id) => id.trim()).filter(Boolean);
    if (!ids.length) return [];
    return this.prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, schoolId: true },
    });
  }

  @Get('auth-usage/:authUserId')
  @ApiOperation({ summary: 'Report how an auth user is used in student data (for safe delete)' })
  async authUsage(@Param('authUserId') authUserId: string) {
    const [student, guardian, classTeacherCount] = await Promise.all([
      this.prisma.student.findUnique({ where: { authUserId }, select: { id: true, registrationNumber: true } }),
      this.prisma.guardian.findUnique({
        where: { authUserId },
        select: { id: true, studentLinks: { where: { isActive: true }, select: { id: true } } },
      }),
      this.prisma.class.count({ where: { classTeacherId: authUserId } }),
    ]);
    return {
      isStudent: Boolean(student),
      studentId: student?.id ?? null,
      registrationNumber: student?.registrationNumber ?? null,
      isGuardian: Boolean(guardian),
      activeChildren: guardian?.studentLinks.length ?? 0,
      isClassTeacher: classTeacherCount > 0,
      classTeacherOf: classTeacherCount,
    };
  }

  @Get('guardian-for-student/:studentId')
  @ApiOperation({ summary: "Resolve a student's primary guardian for notification dispatch" })
  async guardianForStudent(@Param('studentId') studentId: string) {
    const link = await this.prisma.studentGuardianLink.findFirst({
      where: { studentId, isActive: true },
      orderBy: { isPrimary: 'desc' },
      include: { guardian: true },
    });
    if (!link?.guardian) {
      return null;
    }
    const g = link.guardian;
    return {
      guardianId: g.id,
      authUserId: g.authUserId,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      phone: g.phoneNumber,
      relationship: g.relationship,
      isPrimary: link.isPrimary,
    };
  }

  @Get('class/:classId/teachers')
  @ApiOperation({ summary: 'Resolve staff to notify for a class (class teacher)' })
  async classTeachers(@Param('classId') classId: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { classTeacherId: true },
    });
    if (!cls?.classTeacherId) {
      return [];
    }
    return [{ id: cls.classTeacherId, authUserId: cls.classTeacherId, role: 'TEACHER' }];
  }

  @Get('performance-alerts')
  @ApiOperation({ summary: 'Active performance alerts (optionally filtered by comma-separated severities)' })
  async performanceAlerts(@Query('severities') severities?: string) {
    const wanted = (severities || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const alerts = await this.prisma.performanceAlert.findMany({
      where: {
        isResolved: false,
        ...(wanted.length ? { severity: { in: wanted as never[] } } : {}),
      },
      include: { student: true, triggeredBySnapshot: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return alerts.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: `${a.student.firstName} ${a.student.lastName}`.trim(),
      subjectId: a.subjectId,
      subjectName: a.subjectName,
      alertType: a.alertType,
      severity: a.severity,
      teacherId: a.triggeredBySnapshot?.teacherId ?? null,
      classId: a.triggeredBySnapshot?.classId ?? null,
    }));
  }
}
