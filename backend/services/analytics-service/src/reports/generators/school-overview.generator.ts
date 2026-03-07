import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class SchoolOverviewGenerator {
  async generate(filePath: string, data: any) {
    const topSubjects = (data.academic?.subjectPassRates || []).slice(0, 5);
    const bottomSubjects = (data.academic?.subjectPassRates || []).slice(-5);
    const paymentMethods = (data.finance?.paymentMethodBreakdown || []).slice(0, 8);
    await createPdf(filePath, 'School Overview Report', [
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
          ...topSubjects.map((item: any) => `Top Subject: ${item.subjectName} (${Number(item.passRate || 0).toFixed(2)}% pass)`),
          ...bottomSubjects.map((item: any) => `Needs Attention: ${item.subjectName} (${Number(item.passRate || 0).toFixed(2)}% pass)`),
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
        bullets: paymentMethods.map((item: any) => `Method ${item.method}: ${item.amount?.toString?.() ?? item.amount ?? 0} (${item.count || 0} txns)`),
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
          ...(data.kpiTrends?.enrolmentByTerm || []).slice(-6).map((item: any) => `Enrolment ${item.period}: ${item.count}`),
          ...(data.kpiTrends?.passRateByTerm || []).slice(-3).map((item: any) => `Pass Rate ${item.period}: ${Number(item.rate || 0).toFixed(2)}%`),
        ],
      },
    ]);
  }
}
