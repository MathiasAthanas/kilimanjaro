import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { num } from './report.format';

@Injectable()
export class TeacherPerformanceGenerator {
  async generate(filePath: string, data: any) {
    await createReport(filePath, `Teacher Performance Report${data.teacherName ? ` - ${data.teacherName}` : ''}`, [
      {
        heading: 'Teacher Summary',
        rows: [
          ['Teacher', data.teacherName || 'N/A', 'text'],
          ['Overall Average', data.overallClassAverage || 0, 'percent'],
          ['Overall Pass Rate', data.overallPassRate || 0, 'percent'],
          ['Subjects Taught', (data.subjects || []).length, 'int'],
        ],
        tables: [
          {
            title: 'Subjects and classes',
            columns: [
              { header: 'Subject', weight: 2 },
              { header: 'Class', weight: 1.6 },
              { header: 'Average', kind: 'decimal' },
              { header: 'Pass rate %', kind: 'percent' },
              { header: 'Syllabus %', kind: 'percent' },
              { header: 'On time', kind: 'int', weight: 0.8 },
              { header: 'Late', kind: 'int', weight: 0.8 },
            ],
            rows: (data.subjects || []).map((row: any) => [
              row.subjectName,
              row.className,
              num(row.classAverage),
              num(row.passRate),
              num(row.syllabusCompletion),
              num(row.submissionsOnTime),
              num(row.submissionsLate),
            ]),
          },
        ],
      },
      {
        heading: 'Term Trend',
        rows: [['Trend Points', (data.termTrend || []).length, 'int']],
        tables: [
          {
            columns: [{ header: 'Term' }, { header: 'Average', kind: 'decimal' }, { header: 'Pass rate %', kind: 'percent' }],
            rows: (data.termTrend || []).map((row: any) => [row.term, num(row.average), num(row.passRate)]),
          },
        ],
      },
    ]);
  }
}
