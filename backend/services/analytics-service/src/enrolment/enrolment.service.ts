import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { toChart } from '../common/helpers/chart-formatter.helper';

@Injectable()
export class EnrolmentService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async enrolment(academicYearId?: string, termId?: string) {
    const key = `analytics:enrolment:${academicYearId || 'all'}:${termId || 'all'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const students = await this.prisma.student.findMany();
    const byGender = students.reduce<Record<string, number>>((acc, s) => { acc[s.gender] = (acc[s.gender] || 0) + 1; return acc; }, {});
    const byStatus = students.reduce<Record<string, number>>((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

    const classes = await this.prisma.class.findMany({ where: { academicYearId: academicYearId || undefined } });
    const byClass = await Promise.all(classes.map(async (c) => ({ className: c.name, stream: c.stream, count: await this.prisma.enrolment.count({ where: { classId: c.id, isActive: true } }), capacity: c.capacity })));

    const years = await this.prisma.academicYear.findMany({ orderBy: { name: 'asc' } });
    const byYear = [] as any[];
    for (let i = 0; i < years.length; i += 1) {
      const count = await this.prisma.enrolment.count({ where: { academicYearId: years[i].id, isActive: true } });
      const prev = i > 0 ? byYear[i - 1].count : count;
      byYear.push({ year: years[i].name, count, growthRate: prev ? ((count - prev) / prev) * 100 : 0 });
    }

    const terms = await this.prisma.term.findMany({ orderBy: { name: 'asc' } });
    const byTerm = await Promise.all(terms.map(async (t) => ({ term: t.name, year: t.academicYearId, count: await this.prisma.enrolment.count({ where: { termId: t.id, isActive: true } }) })));

    const result = {
      summary: {
        total: students.length,
        active: students.filter((s) => s.status === 'ACTIVE').length,
        byGender,
        byClass,
        byStatus,
        byNationality: students.reduce<Record<string, number>>((acc, s) => { acc[s.nationality] = (acc[s.nationality] || 0) + 1; return acc; }, {}),
      },
      trends: {
        byYear,
        byTerm,
        admissionsVsLeavers: byYear.map((y) => ({ period: y.year, admissions: y.count, leavers: 0, net: y.count })),
      },
      demographics: {
        genderRatio: { male: byGender.MALE || 0, female: byGender.FEMALE || 0 },
        averageAdmissionAge: 0,
        nationalityBreakdown: Object.entries(students.reduce<Record<string, number>>((acc, s) => { acc[s.nationality] = (acc[s.nationality] || 0) + 1; return acc; }, {})).map(([nationality, count]) => ({ nationality, count, percentage: (count / students.length) * 100 })),
      },
      classCapacityAnalysis: byClass.map((c) => ({ className: c.className, stream: c.stream, enrolled: c.count, capacity: c.capacity, utilizationRate: c.capacity ? (c.count / c.capacity) * 100 : 0, isOverCapacity: c.count > c.capacity })),
      retentionRate: 0,
      dropoutCount: (byStatus.TRANSFERRED || 0) + (byStatus.EXPELLED || 0),
    };

    await this.redis.set(key, result, 3600);
    return result;
  }

  async chart() {
    const years = await this.prisma.academicYear.findMany({ orderBy: { name: 'asc' } });
    const labels: string[] = [];
    const total: number[] = [];
    const male: number[] = [];
    const female: number[] = [];

    for (const year of years) {
      const terms = await this.prisma.term.findMany({ where: { academicYearId: year.id }, orderBy: { name: 'asc' } });
      for (const term of terms) {
        labels.push(`${year.name}-${term.name}`);
        const enrolments = await this.prisma.enrolment.findMany({ where: { termId: term.id, isActive: true } });
        total.push(enrolments.length);
        const ids = enrolments.map((e) => e.studentId);
        male.push(await this.prisma.student.count({ where: { id: { in: ids }, gender: 'MALE' } }));
        female.push(await this.prisma.student.count({ where: { id: { in: ids }, gender: 'FEMALE' } }));
      }
    }

    return toChart(labels, [
      { label: 'Total', data: total },
      { label: 'MALE', data: male },
      { label: 'FEMALE', data: female },
    ]);
  }
}
