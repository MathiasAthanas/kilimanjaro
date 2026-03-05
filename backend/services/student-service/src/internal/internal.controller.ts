import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Internal')
@Controller('students/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('by-auth/:authUserId')
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

  @Get('guardian-by-auth/:authUserId')
  async guardianByAuth(@Param('authUserId') authUserId: string) {
    const guardian = await this.prisma.guardian.findUnique({
      where: { authUserId },
      include: {
        studentLinks: {
          where: { isActive: true },
          select: { studentId: true },
        },
      },
    });

    if (!guardian) {
      return null;
    }

    return {
      guardianId: guardian.id,
      studentIds: guardian.studentLinks.map((link) => link.studentId),
    };
  }

  @Get('class/:classId/student-ids')
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
}