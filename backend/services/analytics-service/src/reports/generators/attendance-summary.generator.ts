import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { formatClassLabel } from '../../common/helpers/class-label.helper';
import { num, pct } from './report.format';

@Injectable()
export class AttendanceSummaryGenerator {
  async generate(filePath: string, data: any) {
    const rate = num(data.schoolAttendanceRate);
    const below80: any[] = data.studentsBelow80Percent || [];
    const chronic: any[] = data.chronicAbsentees || [];
    const actions = [
      rate < 90
        ? `School attendance is ${pct(rate)}; require class-level intervention plans for any group below 90%.`
        : `School attendance is healthy at ${pct(rate)}.`,
      below80.length
        ? `${below80.length} learners are below 80%; schedule guardian contact and daily monitoring.`
        : 'No learners below 80% were returned for this reporting period.',
      chronic.length
        ? `${chronic.length} chronic absentee records require escalation.`
        : 'No chronic absentee list was returned for this reporting period.',
    ];

    await createReport(filePath, 'Attendance Summary Report', [
      {
        heading: 'Attendance Management View',
        rows: [
          ['School Attendance Rate', data.schoolAttendanceRate ?? 0, 'percent'],
          ['Classes Tracked', (data.byClass || []).length, 'int'],
          ['Learners Below 80%', below80.length, 'int'],
          ['Chronic Absentees', chronic.length, 'int'],
        ],
        bullets: actions,
      },
      {
        heading: 'Attendance By Class',
        rows: [],
        tables: [
          {
            columns: [
              { header: 'Class', weight: 1.8 },
              { header: 'Attendance %', kind: 'percent' },
              { header: 'Absences', kind: 'int' },
              { header: 'Learners below 80%', kind: 'int' },
            ],
            rows: (data.byClass || []).map((row: any) => [formatClassLabel(row.className, row.stream), num(row.attendanceRate), num(row.totalAbsent), num(row.studentsBelow80)]),
          },
        ],
      },
      {
        heading: 'Correlation',
        rows: [
          ['Attendance vs Performance', data.attendanceVsPerformanceCorrelation?.correlation ?? 0, 'decimal'],
          ['Interpretation', data.attendanceVsPerformanceCorrelation?.interpretation ?? 'N/A', 'text'],
          ['Attendance Impact Alerts', data.attendanceVsPerformanceCorrelation?.studentsWithAttendanceImpactAlerts ?? 0, 'int'],
        ],
      },
      {
        heading: 'Trend Highlights',
        rows: [
          ['Daily Trend Points', (data.byDay || []).length, 'int'],
          ['Monthly Trend Points', (data.byMonth || []).length, 'int'],
        ],
        tables: [
          {
            title: 'By day of week',
            columns: [{ header: 'Day' }, { header: 'Attendance %', kind: 'percent' }],
            rows: (data.byDay || []).map((row: any) => [row.dayOfWeek, num(row.rate)]),
          },
          {
            title: 'By month',
            columns: [{ header: 'Month' }, { header: 'Attendance %', kind: 'percent' }],
            rows: (data.byMonth || []).map((row: any) => [row.month, num(row.rate)]),
          },
        ],
      },
      {
        heading: 'Learner Follow-Up List',
        rows: [
          ['Below 80% List', below80.length, 'int'],
          ['Chronic Absentee List', chronic.length, 'int'],
        ],
        tables: [
          {
            title: 'Learners below 80%',
            columns: [
              { header: 'Learner', weight: 2.2 },
              { header: 'Class', weight: 1.4 },
              { header: 'Attendance %', kind: 'percent' },
              { header: 'Absent', kind: 'int', weight: 0.8 },
              { header: 'Sessions', kind: 'int', weight: 0.8 },
            ],
            rows: below80.map((row) => [row.studentName, row.className, num(row.attendanceRate), num(row.totalAbsent), num(row.totalDays)]),
          },
          {
            title: 'Chronic absentees',
            columns: [
              { header: 'Learner', weight: 2.2 },
              { header: 'Class', weight: 1.4 },
              { header: 'Attendance %', kind: 'percent' },
              { header: 'Recent absences', kind: 'int' },
            ],
            rows: chronic.map((row) => [row.studentName, row.className, num(row.attendanceRate), num(row.consecutiveAbsences)]),
          },
        ],
      },
    ]);
  }
}
