import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { formatClassLabel } from '../../common/helpers/class-label.helper';
import { num, pct } from './report.format';

@Injectable()
export class SchoolOverviewGenerator {
  async generate(filePath: string, data: any, title = 'School Overview Report') {
    const subjectRates: any[] = data.academic?.subjectPassRates || [];
    const paymentMethods: any[] = data.finance?.paymentMethodBreakdown || [];
    const enrolmentByClass: any[] = data.enrolment?.byClass || [];
    const collectionRate = num(data.finance?.collectionRateThisTerm);
    const attendanceRate = num(data.attendance?.schoolAttendanceRate);
    const passRate = num(data.academic?.overallPassRate);
    const criticalAlerts = num(data.academic?.criticalAlertCount);
    const actionNotes = [
      collectionRate < 80
        ? `Fee collection is below target at ${pct(collectionRate)}; prioritize overdue follow-up and class-level defaulter review.`
        : `Fee collection is within a healthy band at ${pct(collectionRate)}.`,
      criticalAlerts > 0
        ? `${criticalAlerts} critical academic alerts require assigned owners and follow-up dates.`
        : 'No critical academic alerts are currently active.',
      attendanceRate < 90
        ? `Attendance is ${pct(attendanceRate)}; monitor classes and learners below 80%.`
        : `Attendance is strong at ${pct(attendanceRate)}.`,
      passRate < 75
        ? 'Pass rate is below the board target; review weak subjects and class interventions.'
        : `Overall pass rate is ${pct(passRate)}, indicating strong published-result performance.`,
    ];

    await createReport(filePath, title, [
      {
        heading: 'Executive KPIs',
        rows: [
          ['School Average', data.academic?.schoolAverage ?? 0, 'percent'],
          ['Overall Pass Rate', data.academic?.overallPassRate ?? 0, 'percent'],
          ['Collection Rate', data.finance?.collectionRateThisTerm ?? 0, 'percent'],
          ['Attendance Rate', data.attendance?.schoolAttendanceRate ?? 0, 'percent'],
        ],
        bullets: actionNotes,
      },
      {
        heading: 'Enrolment',
        rows: [
          ['Total Students', data.enrolment?.totalStudents ?? 0, 'int'],
          ['Active Students', data.enrolment?.activeStudents ?? 0, 'int'],
          ['Male Students', data.enrolment?.byGender?.MALE ?? 0, 'int'],
          ['Female Students', data.enrolment?.byGender?.FEMALE ?? 0, 'int'],
          ['New Admissions This Term', data.enrolment?.newAdmissionsThisTerm ?? 0, 'int'],
          ['New Admissions This Year', data.enrolment?.newAdmissionsThisYear ?? 0, 'int'],
          ['Growth Rate (%)', data.enrolment?.enrolmentGrowthRate ?? 0, 'percent'],
        ],
        tables: [
          {
            title: 'Learners by class',
            columns: [{ header: 'Class' }, { header: 'Active learners', kind: 'int' }],
            rows: enrolmentByClass.map((row) => [formatClassLabel(row.className, row.stream), num(row.count)]),
          },
        ],
      },
      {
        heading: 'Academic',
        rows: [
          ['Overall Pass Rate', data.academic?.overallPassRate ?? 0, 'percent'],
          ['School Average', data.academic?.schoolAverage ?? 0, 'percent'],
          ['Published Results', data.academic?.totalPublishedResults ?? 0, 'int'],
          ['At Risk Students', data.academic?.atRiskStudentCount ?? 0, 'int'],
          ['Critical Alerts', data.academic?.criticalAlertCount ?? 0, 'int'],
          ['Improving Students', data.academic?.improvingStudentCount ?? 0, 'int'],
          ['Active Pairings', data.academic?.activePairingCount ?? 0, 'int'],
          ['Pairing Success Rate (%)', data.academic?.pairingSuccessRate ?? 0, 'percent'],
        ],
        tables: [
          {
            title: 'Subject performance',
            columns: [{ header: 'Subject' }, { header: 'Results', kind: 'int' }, { header: 'Average %', kind: 'percent' }, { header: 'Pass rate %', kind: 'percent' }],
            rows: subjectRates.map((row) => [row.subjectName, num(row.results), num(row.average), num(row.passRate)]),
          },
        ],
      },
      {
        heading: 'Finance',
        rows: [
          ['Total Billed', data.finance?.totalBilledThisTerm?.toString?.() ?? 0, 'money'],
          ['Total Collected', data.finance?.totalCollectedThisTerm?.toString?.() ?? 0, 'money'],
          ['Collection Rate', data.finance?.collectionRateThisTerm ?? 0, 'percent'],
          ['Total Outstanding', data.finance?.totalOutstanding?.toString?.() ?? 0, 'money'],
          ['Overdue Invoices', data.finance?.overdueCount ?? 0, 'int'],
          ['Overdue Amount', data.finance?.overdueAmount?.toString?.() ?? 0, 'money'],
        ],
        tables: [
          {
            title: 'Confirmed payments by method',
            columns: [{ header: 'Method' }, { header: 'Transactions', kind: 'int' }, { header: 'Amount', kind: 'money' }],
            rows: paymentMethods.map((row) => [String(row.method || 'Unknown').replaceAll('_', ' '), num(row.count), num(row.amount)]),
          },
        ],
      },
      {
        heading: 'Attendance',
        rows: [
          ['Attendance Rate', data.attendance?.schoolAttendanceRate ?? 0, 'percent'],
          ['Classes Below 80%', data.attendance?.classesBelow80Percent ?? 0, 'int'],
          ['Students Below 80%', data.attendance?.studentsBelow80Percent ?? 0, 'int'],
        ],
      },
      {
        heading: 'Notifications & Trends',
        rows: [
          ['Notifications Sent (Month)', data.notifications?.totalSentThisMonth ?? 0, 'int'],
          ['SMS Sent (Month)', data.notifications?.smsSentThisMonth ?? 0, 'int'],
          ['Delivery Rate (%)', data.notifications?.deliveryRate ?? 0, 'percent'],
        ],
        tables: [
          {
            title: 'Enrolment by term',
            columns: [{ header: 'Term' }, { header: 'Learners', kind: 'int' }],
            rows: (data.kpiTrends?.enrolmentByTerm || []).map((row: any) => [row.period, num(row.count)]),
          },
          {
            title: 'Pass rate by term',
            columns: [{ header: 'Term' }, { header: 'Pass rate %', kind: 'percent' }],
            rows: (data.kpiTrends?.passRateByTerm || []).map((row: any) => [row.period, num(row.rate)]),
          },
        ],
      },
    ]);
  }
}
