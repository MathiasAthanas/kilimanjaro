import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { mean } from '../common/helpers/statistics.helper';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  private async currentYearId() {
    return (await this.prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
  }

  async getOverview(academicYearId?: string) {
    const yearId = academicYearId || (await this.currentYearId()) || undefined;
    const cacheKey = `analytics:overview:${yearId || 'current'}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const [students, activeStudents, byGender, byStatus, classes, terms, termResults, alerts, pairings, invoices, payments, attendance, notifications] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.student.count({ where: { status: 'ACTIVE' } }),
      this.prisma.student.groupBy({ by: ['gender'], _count: { _all: true } }),
      this.prisma.student.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.class.findMany({ where: { academicYearId: yearId }, select: { id: true, name: true, stream: true } }),
      this.prisma.term.findMany({ where: { academicYearId: yearId }, orderBy: { name: 'asc' } }),
      this.prisma.termResult.findMany({ where: { academicYearId: yearId, isPublished: true }, select: { weightedTotal: true, isPassing: true, subjectName: true } }),
      this.prisma.performanceAlert.findMany({ where: { isResolved: false }, select: { severity: true, alertType: true } }),
      this.prisma.peerPairing.findMany({ where: { status: 'COMPLETED' }, select: { outcomeDelta: true } }),
      this.prisma.invoice.findMany({ where: { academicYearId: yearId }, select: { totalAmount: true, paidAmount: true, outstandingBalance: true, status: true } }),
      this.prisma.payment.findMany({ where: { status: 'CONFIRMED' }, select: { method: true, amount: true } }),
      this.prisma.attendanceRecord.findMany({ select: { status: true } }),
      this.prisma.notification.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, select: { channel: true, status: true } }),
    ]);

    const enrolByClass = await Promise.all(
      classes.map(async (c) => ({ className: c.name, stream: c.stream, count: await this.prisma.enrolment.count({ where: { classId: c.id, isActive: true } }) })),
    );

    const byGenderObj = Object.fromEntries(byGender.map((x) => [x.gender, x._count._all]));
    const byStatusObj = Object.fromEntries(byStatus.map((x) => [x.status, x._count._all]));
    const overallPassRate = termResults.length ? (termResults.filter((r) => r.isPassing).length / termResults.length) * 100 : 0;
    const schoolAverage = mean(termResults.map((r) => r.weightedTotal));
    const atRisk = alerts.filter((a) => ['AT_RISK', 'FAILURE_RISK'].includes(a.alertType)).length;
    const critical = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const improving = alerts.filter((a) => a.alertType === 'RAPID_IMPROVEMENT').length;
    const pairingSuccess = pairings.length ? (pairings.filter((p) => (p.outcomeDelta || 0) > 0).length / pairings.length) * 100 : 0;

    const totalBilled = invoices.reduce((acc, i) => acc.plus(i.totalAmount), new Prisma.Decimal(0));
    const totalCollected = invoices.reduce((acc, i) => acc.plus(i.paidAmount), new Prisma.Decimal(0));
    const totalOutstanding = invoices.reduce((acc, i) => acc.plus(i.outstandingBalance), new Prisma.Decimal(0));
    const overdue = invoices.filter((i) => i.status === 'OVERDUE');

    const paymentMethodBreakdown = payments.reduce<Record<string, { amount: Prisma.Decimal; count: number }>>((acc, p) => {
      if (!acc[p.method]) acc[p.method] = { amount: new Prisma.Decimal(0), count: 0 };
      acc[p.method].amount = acc[p.method].amount.plus(p.amount);
      acc[p.method].count += 1;
      return acc;
    }, {});

    const present = attendance.filter((a) => a.status === 'PRESENT').length;
    const schoolAttendanceRate = attendance.length ? (present / attendance.length) * 100 : 0;

    const notifDelivered = notifications.filter((n) => n.status === 'DELIVERED').length;

    const termLabels = terms.map((t) => `${yearId || ''}-${t.name}`);
    const result = {
      enrolment: {
        totalStudents: students,
        activeStudents,
        byGender: { MALE: byGenderObj.MALE || 0, FEMALE: byGenderObj.FEMALE || 0 },
        byClass: enrolByClass,
        byStatus: byStatusObj,
        newAdmissionsThisTerm: 0,
        newAdmissionsThisYear: 0,
        enrolmentGrowthRate: 0,
      },
      academic: {
        overallPassRate,
        schoolAverage,
        totalPublishedResults: termResults.length,
        atRiskStudentCount: atRisk,
        criticalAlertCount: critical,
        improvingStudentCount: improving,
        activePairingCount: pairings.length,
        pairingSuccessRate: pairingSuccess,
        subjectPassRates: [],
      },
      finance: {
        totalBilledThisTerm: totalBilled,
        totalCollectedThisTerm: totalCollected,
        collectionRateThisTerm: totalBilled.gt(0) ? Number(totalCollected.div(totalBilled).mul(100).toFixed(2)) : 0,
        totalOutstanding,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((acc, x) => acc.plus(x.outstandingBalance), new Prisma.Decimal(0)),
        paymentMethodBreakdown: Object.entries(paymentMethodBreakdown).map(([method, item]) => ({ method, amount: item.amount, count: item.count })),
      },
      attendance: {
        schoolAttendanceRate,
        classesBelow80Percent: 0,
        studentsBelow80Percent: 0,
      },
      notifications: {
        totalSentThisMonth: notifications.length,
        smsSentThisMonth: notifications.filter((x) => x.channel === 'SMS').length,
        deliveryRate: notifications.length ? (notifDelivered / notifications.length) * 100 : 0,
      },
      kpiTrends: {
        enrolmentByTerm: termLabels.map((p) => ({ period: p, count: students })),
        collectionRateByTerm: termLabels.map((p) => ({ period: p, rate: 0 })),
        passRateByTerm: termLabels.map((p) => ({ period: p, rate: overallPassRate })),
        attendanceRateByTerm: termLabels.map((p) => ({ period: p, rate: schoolAttendanceRate })),
      },
    };

    await this.redis.set(cacheKey, result, 1800);
    return result;
  }
}
