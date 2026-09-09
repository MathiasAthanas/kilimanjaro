import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Group-level analytics for the multi-school expansion (Doc 02 §5):
 * whole-group KPIs + per-school scorecards + consolidated finance.
 * Reads the same cross-schema tables the rest of analytics already uses,
 * grouped by the new schoolId columns.
 */
@Injectable()
export class GroupService {
  constructor(private readonly prisma: PrismaService) {}

  private num(value: unknown): number {
    return Number(value ?? 0) || 0;
  }

  async schools() {
    const schools = await this.prisma.school.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });

    const [students, capacity, invoices, results, attendance, alerts] = await Promise.all([
      this.prisma.student.groupBy({ by: ['schoolId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      this.prisma.class.groupBy({ by: ['schoolId'], _sum: { capacity: true } }),
      this.prisma.invoice.groupBy({
        by: ['schoolId'],
        _sum: { totalAmount: true, paidAmount: true, outstandingBalance: true },
      }),
      this.prisma.termResult.groupBy({
        by: ['schoolId'],
        where: { isPublished: true },
        _avg: { weightedTotal: true },
        _count: { _all: true },
      }),
      this.prisma.attendanceRecord.groupBy({ by: ['schoolId', 'status'], _count: { _all: true } }),
      this.prisma.performanceAlert.findMany({ where: { isResolved: false }, select: { studentId: true } }),
    ]);

    // at-risk per school needs the student → school map for unresolved alerts
    const alertStudentIds = [...new Set(alerts.map((a) => a.studentId))];
    const alertStudents = alertStudentIds.length
      ? await this.prisma.student.findMany({ where: { id: { in: alertStudentIds } }, select: { id: true, schoolId: true } })
      : [];
    const atRiskBySchool = new Map<string, number>();
    for (const s of alertStudents) {
      if (!s.schoolId) continue;
      atRiskBySchool.set(s.schoolId, (atRiskBySchool.get(s.schoolId) ?? 0) + 1);
    }

    const attendanceBySchool = new Map<string, { present: number; total: number }>();
    for (const row of attendance) {
      if (!row.schoolId) continue;
      const entry = attendanceBySchool.get(row.schoolId) ?? { present: 0, total: 0 };
      entry.total += row._count._all;
      if (row.status === 'PRESENT' || row.status === 'LATE') entry.present += row._count._all;
      attendanceBySchool.set(row.schoolId, entry);
    }

    const pick = <T extends { schoolId: string | null }>(rows: T[], id: string) =>
      rows.find((r) => r.schoolId === id);

    return schools.map((school) => {
      const st = pick(students, school.id);
      const cap = pick(capacity, school.id);
      const inv = pick(invoices, school.id);
      const res = pick(results, school.id);
      const att = attendanceBySchool.get(school.id);
      const invoiced = this.num(inv?._sum.totalAmount);
      const collected = this.num(inv?._sum.paidAmount);
      const capacityTotal = this.num(cap?._sum.capacity);
      const studentCount = this.num(st?._count._all);
      const academicMean = res?._avg.weightedTotal != null ? Number(res._avg.weightedTotal.toFixed(1)) : null;
      const collectionRate = invoiced > 0 ? Number(((collected / invoiced) * 100).toFixed(1)) : null;
      const attendanceRate = att && att.total > 0 ? Number(((att.present / att.total) * 100).toFixed(1)) : null;
      const atRisk = atRiskBySchool.get(school.id) ?? 0;

      // simple weighted health signal for the scorecards
      let health: 'GOOD' | 'WATCH' | 'CRITICAL' = 'GOOD';
      if ((collectionRate !== null && collectionRate < 60) || (academicMean !== null && academicMean < 45)) health = 'CRITICAL';
      else if ((collectionRate !== null && collectionRate < 75) || (academicMean !== null && academicMean < 55) || atRisk > 10) health = 'WATCH';

      return {
        id: school.id,
        name: school.name,
        code: school.code,
        type: school.type,
        gender: school.gender,
        logoUrl: school.logoUrl,
        isActive: school.isActive,
        students: studentCount,
        capacity: capacityTotal,
        capacityFillPct: capacityTotal > 0 ? Number(((studentCount / capacityTotal) * 100).toFixed(1)) : null,
        academicMean,
        collectionRate,
        invoiced,
        collected,
        outstanding: this.num(inv?._sum.outstandingBalance),
        attendanceRate,
        atRisk,
        health,
      };
    });
  }

  async overview() {
    const schools = await this.schools();
    const active = schools.filter((s) => s.isActive);

    const totalStudents = active.reduce((sum, s) => sum + s.students, 0);
    const invoiced = active.reduce((sum, s) => sum + s.invoiced, 0);
    const collected = active.reduce((sum, s) => sum + s.collected, 0);
    const outstanding = active.reduce((sum, s) => sum + s.outstanding, 0);
    const meanRows = active.filter((s) => s.academicMean !== null && s.students > 0);
    const weighted = meanRows.reduce((sum, s) => sum + (s.academicMean as number) * s.students, 0);
    const weightBase = meanRows.reduce((sum, s) => sum + s.students, 0);

    return {
      totals: {
        schools: active.length,
        students: totalStudents,
        invoiced,
        collected,
        outstanding,
        collectionRate: invoiced > 0 ? Number(((collected / invoiced) * 100).toFixed(1)) : null,
        academicMean: weightBase > 0 ? Number((weighted / weightBase).toFixed(1)) : null,
        atRisk: active.reduce((sum, s) => sum + s.atRisk, 0),
        needingAttention: active.filter((s) => s.health !== 'GOOD').length,
      },
      schools,
      attention: active
        .filter((s) => s.health !== 'GOOD')
        .map((s) => ({
          id: s.id,
          name: s.name,
          health: s.health,
          reasons: [
            ...(s.collectionRate !== null && s.collectionRate < 75 ? [`Collection at ${s.collectionRate}%`] : []),
            ...(s.academicMean !== null && s.academicMean < 55 ? [`Academic mean ${s.academicMean}%`] : []),
            ...(s.atRisk > 10 ? [`${s.atRisk} students at risk`] : []),
          ],
        })),
    };
  }

  async finance() {
    const schools = await this.schools();
    const active = schools.filter((s) => s.isActive);
    const invoiced = active.reduce((sum, s) => sum + s.invoiced, 0);
    const collected = active.reduce((sum, s) => sum + s.collected, 0);

    // per-term trend across the group
    const terms = await this.prisma.term.findMany({ orderBy: { name: 'asc' } });
    const byTerm = await this.prisma.invoice.groupBy({
      by: ['termId'],
      _sum: { totalAmount: true, paidAmount: true },
    });
    const trend = terms.map((t) => {
      const row = byTerm.find((b) => b.termId === t.id);
      const inv = this.num(row?._sum.totalAmount);
      const col = this.num(row?._sum.paidAmount);
      return { termId: t.id, period: t.name, invoiced: inv, collected: col, rate: inv > 0 ? Number(((col / inv) * 100).toFixed(1)) : 0 };
    });

    return {
      totals: {
        invoiced,
        collected,
        outstanding: active.reduce((sum, s) => sum + s.outstanding, 0),
        collectionRate: invoiced > 0 ? Number(((collected / invoiced) * 100).toFixed(1)) : null,
      },
      bySchool: active.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        invoiced: s.invoiced,
        collected: s.collected,
        outstanding: s.outstanding,
        collectionRate: s.collectionRate,
      })),
      trend,
    };
  }
}
