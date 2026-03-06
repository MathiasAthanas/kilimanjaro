import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTimetableDto) {
    return this.prisma.timetable.create({ data: dto });
  }

  list(filters: { classId?: string; termId?: string; teacherId?: string; dayOfWeek?: string }) {
    return this.prisma.timetable.findMany({
      where: {
        classId: filters.classId,
        termId: filters.termId,
        teacherId: filters.teacherId,
        dayOfWeek: filters.dayOfWeek as any,
      },
      include: { subject: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  delete(id: string) {
    return this.prisma.timetable.delete({ where: { id } });
  }
}
