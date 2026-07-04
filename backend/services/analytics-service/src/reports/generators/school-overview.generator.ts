import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class SchoolOverviewGenerator {
  async generate(filePath: string, data: any) {
    const topSubjects = (data.academic?.subjectPassRates || []).slice(0, 5);
    const bottomSubjects = (data.academic?.subjectPassRates || []).slice(-5);
    const paymentMethods = (data.finance?.paymentMethodBreakdown || []).slice(0, 8);
    const enrolmentByClass = (data.enrolment?.byClass || []).slice(0, 12);
    const collectionRate = Number(data.finance?.collectionRateThisTerm ?? 0);
    const attendanceRate = Number(data.attendance?.schoolAttendanceRate ?? 0);
    const passRate = Number(data.academic?.overallPassRate ?? 0);
    const criticalAlerts = Number(data.academic?.criticalAlertCount ?? 0);
    const actionNotes = [
      collectionRate < 80
        ? `Fee collection is below target at ${collectionRate.toFixed(2)}%; prioritize overdue follow-up and class-level defaulter review.`
        : `Fee collection is within a healthy band at ${collectionRate.toFixed(2)}%.`,
      criticalAlerts > 0
        ? `${criticalAlerts} critical academic alerts require assigned owners and follow-up dates.`
        : 'No critical academic alerts are currently active.',
      attendanceRate < 90
        ? `Attendance is ${attendanceRate.toFixed(2)}%; monitor classes and learners below 80%.`
        : `Attendance is strong at ${attendanceRate.toFixed(2)}%.`,
      passRate < 75
        ? `Pass rate is below the board target; review weak subjects and class interventions.`
        : `Overall pass rate is ${passRate.toFixed(2)}%, indicating strong published-result performance.`,
    ];

    await createPdf(filePath, 'School Overview Report', [
      {
        heading: 'Executive KPIs',
        rows: [
          ['School Average', data.academic?.schoolAverage ?? 0],
          ['Overall Pass Rate', data.academic?.overallPassRate ?? 0],
          ['Collection Rate', data.finance?.collectionRateThisTerm ?? 0],
          ['Attendance Rate', data.attendance?.schoolAttendanceRate ?? 0],
        ],
        bullets: actionNotes,
      },
      {
        heading: 'Enrolment',
        rows: [
          ['Total Students', data.enrolment?.totalStudents ?? 0],
          ['Active Students', data.enrolment?.activeStudents ?? 0],
          ['Male Students', data.enrolment?.byGender?.MALE ?? 0],
          ['Female Students', data.enrolment?.byGender?.FEMALE ?? 0],
          ['New Admissions This Term', data.enrolment?.newAdmissionsThisTerm ?? 0],
          ['New Admissions This Year', data.enrolment?.newAdmissionsThisYear ?? 0],
          ['Growth Rate (%)', data.enrolment?.enrolmentGrowthRate ?? 0],
        ],
        bullets: enrolmentByClass.map(
          (row: any) => `${row.className}${row.stream ? ` ${row.stream}` : ''}: ${Number(row.count || 0).toLocaleString('en-US')} active learners`,
        ),
      },
      {
        heading: 'Academic',
        rows: [
          ['Overall Pass Rate', data.academic?.overallPassRate ?? 0],
          ['School Average', data.academic?.schoolAverage ?? 0],
          ['Published Results', data.academic?.totalPublishedResults ?? 0],
          ['At Risk Students', data.academic?.atRiskStudentCount ?? 0],
          ['Critical Alerts', data.academic?.criticalAlertCount ?? 0],
          ['Improving Students', data.academic?.improvingStudentCount ?? 0],
          ['Active Pairings', data.academic?.activePairingCount ?? 0],
          ['Pairing Success Rate (%)', data.academic?.pairingSuccessRate ?? 0],
        ],
        bullets: [
          ...topSubjects.map((item: any) => `Top subject: ${item.subjectName} - ${Number(item.passRate || 0).toFixed(2)}% pass, ${Number(item.average || 0).toFixed(2)}% average across ${item.results || 0} results.`),
          ...bottomSubjects.map((item: any) => `Needs attention: ${item.subjectName} - ${Number(item.passRate || 0).toFixed(2)}% pass, ${Number(item.average || 0).toFixed(2)}% average.`),
        ],
      },
      {
        heading: 'Finance',
        rows: [
          ['Total Billed', data.finance?.totalBilledThisTerm?.toString?.() ?? 0],
          ['Total Collected', data.finance?.totalCollectedThisTerm?.toString?.() ?? 0],
          ['Collection Rate', data.finance?.collectionRateThisTerm ?? 0],
          ['Total Outstanding', data.finance?.totalOutstanding?.toString?.() ?? 0],
          ['Overdue Invoices', data.finance?.overdueCount ?? 0],
          ['Overdue Amount', data.finance?.overdueAmount?.toString?.() ?? 0],
        ],
        bullets: paymentMethods.map((item: any) => {
          const amount = Number(item.amount?.toString?.() ?? item.amount ?? 0);
          return `${String(item.method || 'Unknown').replaceAll('_', ' ')}: TZS ${amount.toLocaleString('en-US')} from ${item.count || 0} confirmed transactions.`;
        }),
      },
      {
        heading: 'Attendance',
        rows: [
          ['Attendance Rate', data.attendance?.schoolAttendanceRate ?? 0],
          ['Classes Below 80%', data.attendance?.classesBelow80Percent ?? 0],
          ['Students Below 80%', data.attendance?.studentsBelow80Percent ?? 0],
        ],
      },
      {
        heading: 'Notifications & Trends',
        rows: [
          ['Notifications Sent (Month)', data.notifications?.totalSentThisMonth ?? 0],
          ['SMS Sent (Month)', data.notifications?.smsSentThisMonth ?? 0],
          ['Delivery Rate (%)', data.notifications?.deliveryRate ?? 0],
        ],
        bullets: [
          ...(data.kpiTrends?.enrolmentByTerm || []).slice(-6).map((item: any) => `Enrolment ${item.period}: ${Number(item.count || 0).toLocaleString('en-US')} learners`),
          ...(data.kpiTrends?.passRateByTerm || []).slice(-3).map((item: any) => `Pass Rate ${item.period}: ${Number(item.rate || 0).toFixed(2)}%`),
        ],
      },
    ]);
  }
}
