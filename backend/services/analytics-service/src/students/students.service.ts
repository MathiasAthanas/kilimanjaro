import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { applyRoleFilter } from '../common/helpers/role-filter.helper';
import { mean, percentileRank } from '../common/helpers/statistics.helper';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { DownstreamService } from '../downstream/downstream.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly downstream: DownstreamService,
  ) {}

  private gradeFromScore(score: number): string {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  private sum(values: Prisma.Decimal[]): Prisma.Decimal {
    return values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
  }

  private async resolveYear(academicYearId?: string) {
    if (academicYearId) return academicYearId;
    return (await this.prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
  }

  private async canAccessStudent(studentId: string, user?: RequestUser) {
    if (!user) return true;
    if (user.role === 'STUDENT') return user.id === studentId;
    if (user.role !== 'PARENT') return true;

    const link = await this.prisma.studentGuardianLink.findFirst({ where: { guardianId: user.id, studentId } });
    if (link) return true;
    const ids = await this.downstream.guardianStudentIds(user.id);
    return ids.includes(studentId);
  }

  private recommendedActions(args: {
    hasCritical: boolean;
    attendanceRate: number;
    declineSubjects: number;
    activePairing: boolean;
    outstandingAmount: number;
    failingSubjects: number;
  }) {
    const actions: string[] = [];
    if (args.hasCritical) actions.push('Escalate to principal and guardian for immediate intervention.');
    if (args.attendanceRate < 80) actions.push('Start attendance remediation plan with daily follow-up.');
    if (args.declineSubjects >= 2) actions.push('Schedule targeted coaching for declining subjects.');
    if (!args.activePairing && args.failingSubjects > 0) actions.push('Enable peer pairing for weak subjects.');
    if (args.outstandingAmount > 0) actions.push('Coordinate finance follow-up with guardian on outstanding fees.');
    if (args.failingSubjects >= 3) actions.push('Initiate structured intervention with weekly progress checks.');
    return actions.length ? actions : ['Maintain current trajectory and continue weekly monitoring.'];
  }

  async getProfile(studentId: string, user?: RequestUser, academicYearId?: string) {
    if (!(await this.canAccessStudent(studentId, user))) {
      throw new ForbiddenException('You are not authorized for this student profile');
    }

    const yearId = await this.resolveYear(academicYearId);
    const key = `analytics:student:${studentId}:${yearId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return applyRoleFilter(cached, user?.role || 'SYSTEM_ADMIN');

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const [enrolments, classes, terms, reportCards, termResults, trends, alerts, pairings, attendance, discipline, invoices, payments, interventions] =
      await Promise.all([
        this.prisma.enrolment.findMany({ where: { studentId }, orderBy: { academicYearId: 'asc' } }),
        this.prisma.class.findMany(),
        this.prisma.term.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.reportCard.findMany({ where: { studentId, isPublished: true }, orderBy: { academicYearId: 'asc' } }),
        this.prisma.termResult.findMany({ where: { studentId, isPublished: true }, orderBy: { academicYearId: 'asc' } }),
        this.prisma.performanceTrend.findMany({ where: { studentId } }),
        this.prisma.performanceAlert.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.peerPairing.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.attendanceRecord.findMany({ where: { studentId }, orderBy: { date: 'asc' } }),
        this.prisma.disciplineRecord.findMany({ where: { studentId }, orderBy: { incidentDate: 'desc' } }),
        this.prisma.invoice.findMany({ where: { studentId }, orderBy: { dueDate: 'desc' } }),
        this.prisma.payment.findMany({ where: { studentId, status: 'CONFIRMED' }, orderBy: { confirmedAt: 'desc' } }),
        this.prisma.academicIntervention.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } }),
      ]);

    const currentEnrolment = [...enrolments].reverse().find((row) => row.isActive) || enrolments[enrolments.length - 1];
    const currentClass = classes.find((row) => row.id === currentEnrolment?.classId);
    const currentTerm = terms.find((row) => row.isCurrent) || terms[terms.length - 1];
    const currentCard = reportCards.find((row) => row.termId === currentTerm?.id) || reportCards[reportCards.length - 1];
    const currentResults = termResults.filter((row) => row.termId === currentTerm?.id);

    const activeAlerts = alerts.filter((row) => !row.isResolved);
    const currentAttendanceRows = attendance.filter((row) => row.termId === currentTerm?.id);
    const attendanceRate = attendance.length ? (attendance.filter((row) => row.status === 'PRESENT').length / attendance.length) * 100 : 0;
    const currentAttendanceRate = currentAttendanceRows.length
      ? (currentAttendanceRows.filter((row) => row.status === 'PRESENT').length / currentAttendanceRows.length) * 100
      : 0;
    const outstanding = this.sum(invoices.map((row) => row.outstandingBalance));
    const paidAll = this.sum(payments.map((row) => row.amount));

    const termHistory = reportCards.map((card) => ({
      termName: terms.find((term) => term.id === card.termId)?.name || card.termId,
      academicYear: card.academicYearId,
      overallAverage: card.overallAverage,
      overallGrade: card.overallGrade,
      rank: card.rank,
      totalStudentsInClass: card.totalStudentsInClass,
      subjectResults: termResults
        .filter((row) => row.termId === card.termId && row.academicYearId === card.academicYearId)
        .map((row) => ({ subjectName: row.subjectName, score: row.weightedTotal, grade: row.grade })),
    }));

    const yearlyAverages = Object.entries(
      termHistory.reduce<Record<string, number[]>>((acc, row) => {
        if (!acc[row.academicYear]) acc[row.academicYear] = [];
        acc[row.academicYear].push(row.overallAverage);
        return acc;
      }, {}),
    ).map(([year, values]) => ({ year, average: mean(values), grade: this.gradeFromScore(mean(values)), rank: null }));

    const trendRows = trends.map((trend) => ({
      subjectName: trend.subjectName,
      trendDirection: trend.trendDirection,
      trendSlope: trend.trendSlope || 0,
      averageScore: trend.averageScore,
      consecutiveDeclines: trend.consecutiveDeclines,
      consecutiveImprovements: trend.consecutiveImprovements,
      chartData: termHistory
        .map((t) => ({ termName: t.termName, score: t.subjectResults.find((x) => x.subjectName === trend.subjectName)?.score || 0 }))
        .filter((x) => x.score > 0),
    }));

    const byTrend = [...trends].sort((a, b) => b.averageScore - a.averageScore);
    const bestSubject = byTrend[0] ? { subjectName: byTrend[0].subjectName, averageScore: byTrend[0].averageScore, trend: byTrend[0].trendDirection } : null;
    const weakestSubject = byTrend[byTrend.length - 1]
      ? { subjectName: byTrend[byTrend.length - 1].subjectName, averageScore: byTrend[byTrend.length - 1].averageScore, trend: byTrend[byTrend.length - 1].trendDirection }
      : null;
    const mostImproved = [...trends].sort((a, b) => (b.trendSlope || 0) - (a.trendSlope || 0))[0];
    const mostDeclined = [...trends].sort((a, b) => (a.trendSlope || 0) - (b.trendSlope || 0))[0];

    const disciplineBySeverity = discipline.reduce<Record<string, number>>((acc, row) => {
      acc[row.severity] = (acc[row.severity] || 0) + 1;
      return acc;
    }, { MINOR: 0, MODERATE: 0, SEVERE: 0 });

    const disciplineByCategory = discipline.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1;
      return acc;
    }, {});

    const projectedScore = (currentCard?.overallAverage || mean(currentResults.map((row) => row.weightedTotal))) + mean(trends.map((row) => row.trendSlope || 0));
    const alertSeverity = activeAlerts.map((row) => row.severity);
    const overallRiskLevel = alertSeverity.includes('CRITICAL')
      ? 'CRITICAL'
      : alertSeverity.includes('HIGH')
        ? 'HIGH'
        : alertSeverity.includes('MEDIUM')
          ? 'MEDIUM'
          : alertSeverity.includes('LOW')
            ? 'LOW'
            : 'NONE';

    const classRows = currentClass
      ? await this.prisma.reportCard.findMany({ where: { classId: currentClass.id, termId: currentTerm?.id, isPublished: true }, select: { overallAverage: true, rank: true, totalStudentsInClass: true } })
      : [];
    const schoolRows = await this.prisma.reportCard.findMany({ where: { isPublished: true }, select: { overallAverage: true } });
    const schoolAverages = schoolRows.map((row) => row.overallAverage);
    const studentAvg = currentCard?.overallAverage || mean(currentResults.map((row) => row.weightedTotal));
    const classAverage = mean(classRows.map((row) => row.overallAverage));

    const currentInvoice = invoices[0];
    const overallStatus =
      overallRiskLevel === 'CRITICAL' || attendanceRate < 60 || studentAvg < 45
        ? 'CRITICAL'
        : overallRiskLevel === 'HIGH' || attendanceRate < 75 || studentAvg < 55
          ? 'AT_RISK'
          : studentAvg < 65
            ? 'AVERAGE'
            : studentAvg < 80
              ? 'GOOD'
              : 'EXCELLENT';

    const profile = {
      student: {
        id: student.id,
        registrationNumber: student.registrationNumber,
        fullName: `${student.firstName} ${student.lastName}`,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        age: Math.max(0, new Date().getFullYear() - student.dateOfBirth.getFullYear()),
        nationality: student.nationality,
        admissionDate: student.admissionDate,
        status: student.status,
        profilePhotoUrl: student.profilePhotoUrl,
        currentClass: { className: currentClass?.name || null, stream: currentClass?.stream || null, level: currentClass?.level || null },
        currentAcademicYear: yearId,
        yearsEnrolled: new Set(enrolments.map((row) => row.academicYearId)).size,
      },
      academic: {
        currentTermSummary: {
          termName: currentTerm?.name || null,
          overallAverage: studentAvg,
          overallGrade: currentCard?.overallGrade || this.gradeFromScore(studentAvg),
          rank: currentCard?.rank || null,
          totalStudentsInClass: currentCard?.totalStudentsInClass || null,
          passingSubjects: currentResults.filter((row) => row.isPassing).length,
          failingSubjects: currentResults.filter((row) => !row.isPassing).length,
          subjectResults: currentResults.map((row) => ({
            subjectName: row.subjectName,
            teacherName: `Teacher`,
            assessmentBreakdown: { CAT1: null, CAT2: null, MIDTERM: null, FINAL: null },
            weightedTotal: row.weightedTotal,
            grade: row.grade,
            rank: row.rank,
            totalInClass: row.totalStudentsInClass,
            isPassing: row.isPassing,
            trendDirection: trends.find((trend) => trend.subjectId === row.subjectId)?.trendDirection || 'STABLE',
          })),
        },
        termHistory,
        yearlyAverages,
        bestSubject,
        weakestSubject,
        mostImprovedSubject: mostImproved ? { subjectName: mostImproved.subjectName, improvementDelta: mostImproved.trendSlope || 0 } : null,
        mostDeclinedSubject: mostDeclined ? { subjectName: mostDeclined.subjectName, declineDelta: mostDeclined.trendSlope || 0 } : null,
        gpaHistory: termHistory.map((row) => ({ term: row.termName, gpa: row.overallAverage / 20 })),
        overallSchoolCareerAverage: mean(termHistory.map((row) => row.overallAverage)),
        projectedGrade: this.gradeFromScore(projectedScore),
      },
      performanceEngine: {
        activeAlerts: activeAlerts.map((row) => ({
          alertType: row.alertType,
          severity: row.severity,
          subjectName: row.subjectName,
          message: row.message,
          createdAt: row.createdAt,
          isResolved: row.isResolved,
        })),
        alertHistory: alerts.map((row) => ({
          alertType: row.alertType,
          severity: row.severity,
          subjectName: row.subjectName,
          createdAt: row.createdAt,
          resolvedAt: row.resolvedAt,
          wasResolved: row.isResolved,
        })),
        alertStats: {
          totalAlerts: alerts.length,
          resolvedAlerts: alerts.filter((row) => row.isResolved).length,
          criticalCount: alerts.filter((row) => row.severity === 'CRITICAL').length,
          highCount: alerts.filter((row) => row.severity === 'HIGH').length,
          mostAlertedSubject:
            Object.entries(
              alerts.reduce<Record<string, number>>((acc, row) => {
                acc[row.subjectName] = (acc[row.subjectName] || 0) + 1;
                return acc;
              }, {}),
            ).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        },
        trends: trendRows,
        pairings: pairings.map((row) => ({
          subjectName: row.subjectName,
          peerName: `Peer ${row.peerId}`,
          status: row.status,
          reason: row.reason,
          studentScoreAtPairing: row.studentScoreAtPairing,
          peerScoreAtPairing: row.peerScoreAtPairing,
          outcomeScore: row.outcomeScore,
          outcomeDelta: row.outcomeDelta,
          wasSuccessful: (row.outcomeDelta || 0) > 0,
        })),
        pairingEffectiveness: {
          totalPairings: pairings.length,
          successfulPairings: pairings.filter((row) => (row.outcomeDelta || 0) > 0).length,
          averageImprovement: mean(pairings.map((row) => row.outcomeDelta || 0)),
        },
        overallRiskLevel,
        recommendedActions: this.recommendedActions({
          hasCritical: activeAlerts.some((row) => row.severity === 'CRITICAL'),
          attendanceRate,
          declineSubjects: trends.filter((row) => row.consecutiveDeclines >= 1).length,
          activePairing: pairings.some((row) => row.status === 'ACTIVE'),
          outstandingAmount: Number(outstanding.toString()),
          failingSubjects: currentResults.filter((row) => !row.isPassing).length,
        }),
      },
      attendance: {
        currentTerm: {
          rate: currentAttendanceRate,
          present: currentAttendanceRows.filter((row) => row.status === 'PRESENT').length,
          absent: currentAttendanceRows.filter((row) => row.status === 'ABSENT').length,
          late: currentAttendanceRows.filter((row) => row.status === 'LATE').length,
          excused: currentAttendanceRows.filter((row) => row.status === 'EXCUSED').length,
          totalDays: currentAttendanceRows.length,
        },
        byTerm: terms
          .map((term) => {
            const rows = attendance.filter((row) => row.termId === term.id);
            const present = rows.filter((row) => row.status === 'PRESENT').length;
            return { termName: term.name, rate: rows.length ? (present / rows.length) * 100 : 0, absent: rows.filter((row) => row.status === 'ABSENT').length };
          })
          .filter((row) => row.rate > 0 || row.absent > 0),
        overallRate: attendanceRate,
        calendar: attendance.filter((row) => row.termId === currentTerm?.id).map((row) => ({ date: row.date.toISOString().slice(0, 10), status: row.status })),
        attendanceTrend: terms.map((term) => {
          const rows = attendance.filter((row) => row.termId === term.id);
          const present = rows.filter((row) => row.status === 'PRESENT').length;
          return { term: term.name, rate: rows.length ? (present / rows.length) * 100 : 0 };
        }),
        hasAttendanceImpactAlert: activeAlerts.some((row) => row.alertType.includes('ATTENDANCE')),
        currentPresentStreak: (() => {
          let streak = 0;
          for (let i = attendance.length - 1; i >= 0; i -= 1) {
            if (attendance[i].status === 'PRESENT') streak += 1;
            else break;
          }
          return streak;
        })(),
      },
      discipline: {
        totalIncidents: discipline.length,
        bySeverity: disciplineBySeverity,
        byCategory: disciplineByCategory,
        recentIncidents: discipline.slice(0, 5).map((row) => ({
          category: row.category,
          severity: row.severity,
          incidentDate: row.incidentDate,
          actionTaken: row.actionTaken,
          resolvedAt: row.resolvedAt,
        })),
        disciplineTrend: terms.map((term) => ({ term: term.name, incidentCount: discipline.length })),
        hasEscalatedIncidents: discipline.slice(0, 10).some((row) => row.severity === 'SEVERE'),
      },
      financial: {
        currentInvoice: currentInvoice
          ? {
              invoiceNumber: currentInvoice.invoiceNumber,
              totalAmount: currentInvoice.totalAmount,
              paidAmount: currentInvoice.paidAmount,
              outstandingBalance: currentInvoice.outstandingBalance,
              status: currentInvoice.status,
              dueDate: currentInvoice.dueDate,
              isOverdue: currentInvoice.status === 'OVERDUE',
              daysOverdue: Math.max(0, Math.floor((Date.now() - currentInvoice.dueDate.getTime()) / 86400000)),
            }
          : null,
        paymentHistory: payments.map((row) => ({
          termName: terms.find((term) => invoices.find((inv) => inv.id === row.invoiceId)?.termId === term.id)?.name || null,
          invoiced: invoices.find((inv) => inv.id === row.invoiceId)?.totalAmount || new Prisma.Decimal(0),
          paid: row.amount,
          outstanding: invoices.find((inv) => inv.id === row.invoiceId)?.outstandingBalance || new Prisma.Decimal(0),
          paymentDate: row.confirmedAt || row.paidAt,
          method: row.method,
        })),
        totalPaidAllTime: paidAll,
        totalOutstandingAllTime: outstanding,
        paymentBehavior: invoices.filter((row) => row.status === 'OVERDUE').length === 0 ? 'ALWAYS_ON_TIME' : invoices.filter((row) => row.status === 'OVERDUE').length > 3 ? 'CHRONIC_DEFAULTER' : 'FREQUENTLY_LATE',
        hasFinancialAlert: Number(outstanding.toString()) > 0,
      },
      interventions,
      interventionStats: {
        total: interventions.length,
        followedUp: interventions.filter((row) => row.isFollowedUp).length,
        pending: interventions.filter((row) => !row.isFollowedUp).length,
      },
      comparisons: {
        vsClassAverage: {
          overallDelta: studentAvg - classAverage,
          bySubject: currentResults.map((row) => {
            const subjectScores = termResults.filter((x) => x.subjectId === row.subjectId).map((x) => x.weightedTotal);
            const avg = mean(subjectScores);
            return {
              subjectName: row.subjectName,
              studentScore: row.weightedTotal,
              classAverage: avg,
              delta: row.weightedTotal - avg,
              isAboveAverage: row.weightedTotal >= avg,
            };
          }),
        },
        vsSchoolAverage: {
          overallDelta: studentAvg - mean(schoolAverages),
          percentile: percentileRank(schoolAverages, studentAvg),
        },
        rankHistory: classRows.map((row) => ({
          term: currentTerm?.name || null,
          rankInClass: row.rank,
          totalInClass: row.totalStudentsInClass,
          percentile: row.totalStudentsInClass ? ((row.totalStudentsInClass - (row.rank || row.totalStudentsInClass)) / row.totalStudentsInClass) * 100 : 0,
        })),
      },
      summaryCard: {
        overallStatus,
        strengths: [bestSubject ? `Top performance in ${bestSubject.subjectName}` : 'Stable performance profile', attendanceRate >= 90 ? 'Strong attendance consistency' : 'Attendance needs monitoring'],
        areasForImprovement: [weakestSubject ? `Declining performance in ${weakestSubject.subjectName}` : 'No sharply weak subject', activeAlerts.length ? `${activeAlerts.length} unresolved alerts` : 'No unresolved alerts'],
        recentAchievements: [
          currentCard?.rank ? `Ranked ${currentCard.rank} in latest report card` : 'Latest report card available',
          pairings.filter((row) => (row.outcomeDelta || 0) > 0).length ? 'Positive outcomes in peer pairing' : 'No pairing outcome improvements yet',
        ],
        nextSteps: this.recommendedActions({
          hasCritical: activeAlerts.some((row) => row.severity === 'CRITICAL'),
          attendanceRate,
          declineSubjects: trends.filter((row) => row.consecutiveDeclines >= 1).length,
          activePairing: pairings.some((row) => row.status === 'ACTIVE'),
          outstandingAmount: Number(outstanding.toString()),
          failingSubjects: currentResults.filter((row) => !row.isPassing).length,
        }),
      },
    };

    await this.redis.set(key, profile, 600);
    return applyRoleFilter(profile, user?.role || 'SYSTEM_ADMIN');
  }

  async list(params: {
    classId?: string;
    academicYearId?: string;
    termId?: string;
    search?: string;
    riskLevel?: string;
    hasAlert?: string;
    isOverdue?: string;
    page: number;
    limit: number;
  }) {
    const hash = createHash('sha1').update(JSON.stringify(params)).digest('hex');
    const key = `analytics:students:list:${hash}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { registrationNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const students = await this.prisma.student.findMany({ where });

    const rows = await Promise.all(
      students.map(async (student) => {
        const [alerts, card, attendance, invoices, enrolment] = await Promise.all([
          this.prisma.performanceAlert.findMany({ where: { studentId: student.id, isResolved: false } }),
          this.prisma.reportCard
            .findFirst({
              where: { studentId: student.id, isPublished: true, termId: params.termId || undefined },
              orderBy: [{ academicYearId: 'desc' }, { termId: 'desc' }],
            })
            .catch(() => null),
          this.prisma.attendanceRecord.findMany({ where: { studentId: student.id, termId: params.termId || undefined } }),
          this.prisma.invoice.findMany({ where: { studentId: student.id } }),
          this.prisma.enrolment.findFirst({ where: { studentId: student.id, isActive: true } }),
        ]);

        const klass = enrolment ? await this.prisma.class.findUnique({ where: { id: enrolment.classId }, select: { name: true } }) : null;
        const present = attendance.filter((row) => row.status === 'PRESENT').length;
        const attendanceRate = attendance.length ? (present / attendance.length) * 100 : 0;
        const outstanding = this.sum(invoices.map((row) => row.outstandingBalance));
        const riskLevel = alerts.some((row) => row.severity === 'CRITICAL')
          ? 'CRITICAL'
          : alerts.some((row) => row.severity === 'HIGH')
            ? 'HIGH'
            : alerts.some((row) => row.severity === 'MEDIUM')
              ? 'MEDIUM'
              : 'LOW';

        return {
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          registrationNumber: student.registrationNumber,
          className: klass?.name || null,
          currentAverage: card?.overallAverage || 0,
          currentGrade: card?.overallGrade || 'N/A',
          attendanceRate,
          riskLevel,
          activeAlertCount: alerts.length,
          outstandingBalance: outstanding,
          hasAlert: alerts.length > 0,
          isOverdue: invoices.some((row) => row.status === 'OVERDUE'),
        };
      }),
    );

    const filtered = rows.filter((row) => {
      if (params.classId && row.className !== params.classId) return false;
      if (params.riskLevel && row.riskLevel !== params.riskLevel) return false;
      if (params.hasAlert && String(row.hasAlert) !== params.hasAlert) return false;
      if (params.isOverdue && String(row.isOverdue) !== params.isOverdue) return false;
      return true;
    });

    const page = Math.max(1, params.page);
    const limit = Math.max(1, params.limit);
    const start = (page - 1) * limit;
    const result = {
      data: filtered.slice(start, start + limit),
      pagination: { page, limit, total: filtered.length },
    };

    await this.redis.set(key, result, 300);
    return result;
  }

  async atRisk(classId?: string) {
    const alerts = await this.prisma.performanceAlert.findMany({
      where: { isResolved: false, severity: { in: ['CRITICAL', 'HIGH'] } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    const studentIds = [...new Set(alerts.map((row) => row.studentId))];
    const [students, enrolments, classes, snapshots] = await Promise.all([
      this.prisma.student.findMany({ where: { id: { in: studentIds } } }),
      this.prisma.enrolment.findMany({ where: { studentId: { in: studentIds }, isActive: true } }),
      this.prisma.class.findMany(),
      this.prisma.performanceSnapshot.findMany({ where: { studentId: { in: studentIds } } }),
    ]);

    return alerts
      .map((alert) => {
        const student = students.find((row) => row.id === alert.studentId);
        const enrolment = enrolments.find((row) => row.studentId === alert.studentId);
        const klass = classes.find((row) => row.id === enrolment?.classId);
        const snapshot = snapshots.find((row) => row.studentId === alert.studentId && row.subjectId === alert.subjectId);
        return {
          studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
          className: klass?.name || 'Unknown',
          subject: alert.subjectName,
          alertType: alert.alertType,
          score: snapshot?.score || null,
          daysSinceAlert: Math.floor((Date.now() - alert.createdAt.getTime()) / 86400000),
        };
      })
      .filter((row) => !classId || row.className === classId);
  }

  async topPerformers(classId?: string, subjectId?: string, termId?: string, limit = 10) {
    const rows = await this.prisma.termResult.findMany({
      where: { termId: termId || undefined, subjectId: subjectId || undefined, isPublished: true },
      orderBy: [{ weightedTotal: 'desc' }],
      take: 500,
    });

    const studentIds = [...new Set(rows.map((row) => row.studentId))];
    const [students, enrolments, classes, trends] = await Promise.all([
      this.prisma.student.findMany({ where: { id: { in: studentIds } } }),
      this.prisma.enrolment.findMany({ where: { studentId: { in: studentIds }, isActive: true } }),
      this.prisma.class.findMany(),
      this.prisma.performanceTrend.findMany({ where: { studentId: { in: studentIds }, subjectId: subjectId || undefined } }),
    ]);

    return rows
      .map((row, index) => {
        const student = students.find((x) => x.id === row.studentId);
        const enrolment = enrolments.find((x) => x.studentId === row.studentId);
        const klass = classes.find((x) => x.id === enrolment?.classId);
        return {
          rank: index + 1,
          studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
          className: klass?.name || 'Unknown',
          average: row.weightedTotal,
          grade: row.grade,
          improvementDelta: trends.find((x) => x.studentId === row.studentId)?.trendSlope || 0,
        };
      })
      .filter((row) => !classId || row.className === classId)
      .slice(0, limit);
  }

  async mostImproved(classId?: string, subjectId?: string, _termId?: string) {
    const trends = await this.prisma.performanceTrend.findMany({
      where: { subjectId: subjectId || undefined },
      orderBy: { trendSlope: 'desc' },
      take: 150,
    });

    const studentIds = [...new Set(trends.map((row) => row.studentId))];
    const [students, enrolments, classes] = await Promise.all([
      this.prisma.student.findMany({ where: { id: { in: studentIds } } }),
      this.prisma.enrolment.findMany({ where: { studentId: { in: studentIds }, isActive: true } }),
      this.prisma.class.findMany(),
    ]);

    return trends
      .map((trend) => {
        const student = students.find((row) => row.id === trend.studentId);
        const enrolment = enrolments.find((row) => row.studentId === trend.studentId);
        const klass = classes.find((row) => row.id === enrolment?.classId);
        return {
          studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
          className: klass?.name || 'Unknown',
          subjectName: trend.subjectName,
          previousScore: trend.currentScore - (trend.trendSlope || 0),
          currentScore: trend.currentScore,
          delta: trend.trendSlope || 0,
          trendDirection: trend.trendDirection,
        };
      })
      .filter((row) => !classId || row.className === classId)
      .slice(0, 50);
  }
}
