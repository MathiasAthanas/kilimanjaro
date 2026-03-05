import { ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { paginate, buildPageMeta } from '../common/helpers/pagination.helper';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async mark(dto: MarkAttendanceDto, markedById: string): Promise<unknown> {
    const date = new Date(dto.date);

    const records = await this.prisma.$transaction(
      dto.records.map((record) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            studentId_date_classId: {
              studentId: record.studentId,
              date,
              classId: dto.classId,
            },
          },
          create: {
            studentId: record.studentId,
            classId: dto.classId,
            date,
            termId: dto.termId,
            status: record.status,
            note: record.note,
            markedById,
          },
          update: {
            status: record.status,
            note: record.note,
            markedById,
          },
        }),
      ),
    );

    for (const record of records) {
      if (record.status === AttendanceStatus.ABSENT) {
        await this.rabbitMq.publish('attendance.marked', {
          attendanceId: record.id,
          studentId: record.studentId,
          classId: record.classId,
          date: record.date.toISOString(),
          status: record.status,
        });
      }
    }

    return records;
  }

  async list(filters: AttendanceFilterDto, currentUser?: { id: string; role: string }): Promise<unknown> {
    if (currentUser?.role === 'PARENT') {
      if (!filters.studentId) {
        throw new ForbiddenException('Parent must provide studentId');
      }
      const link = await this.prisma.studentGuardianLink.findFirst({
        where: {
          studentId: filters.studentId,
          isActive: true,
          guardian: { authUserId: currentUser.id },
        },
      });
      if (!link) {
        throw new ForbiddenException('Parent access denied');
      }
    }

    const pagination = paginate(filters.page, filters.limit);

    const where: Prisma.AttendanceRecordWhereInput = {
      studentId: filters.studentId,
      classId: filters.classId,
      termId: filters.termId,
      status: filters.status,
      date: {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        include: { student: true, class: true, term: true },
        orderBy: { date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    const totalRecords = await this.prisma.attendanceRecord.count({ where });
    const presentCount = await this.prisma.attendanceRecord.count({
      where: { ...where, status: AttendanceStatus.PRESENT },
    });

    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

    return {
      items,
      meta: buildPageMeta(pagination.page, pagination.limit, total),
      attendanceRate,
    };
  }

  async summary(studentId: string, currentUser?: { id: string; role: string }): Promise<unknown> {
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

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      include: { term: true },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<
      string,
      {
        termId: string;
        termName: string;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }
    >();

    for (const record of records) {
      const key = record.termId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          termId: record.termId,
          termName: record.term.name,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        });
      }

      const current = grouped.get(key)!;
      current.total += 1;
      if (record.status === AttendanceStatus.PRESENT) current.present += 1;
      if (record.status === AttendanceStatus.ABSENT) current.absent += 1;
      if (record.status === AttendanceStatus.LATE) current.late += 1;
      if (record.status === AttendanceStatus.EXCUSED) current.excused += 1;
    }

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      attendanceRate: item.total > 0 ? (item.present / item.total) * 100 : 0,
      belowThreshold: item.total > 0 ? (item.present / item.total) * 100 < 80 : false,
    }));
  }
}
