import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class TeacherPerformanceGenerator {
  async generate(filePath: string, data: any) {
    const rows = (data.subjects || []).slice(0, 15).map((row: any) => [
      `${row.subjectName} (${row.className})`,
      `Avg ${Number(row.classAverage || 0).toFixed(2)} | Pass ${Number(row.passRate || 0).toFixed(2)}%`,
    ]);
    await createPdf(filePath, `Teacher Performance Report - ${data.teacherName || ''}`, [
      {
        heading: 'Teacher Summary',
        rows: [
          ['Teacher', data.teacherName || 'N/A'],
          ['Overall Average', data.overallClassAverage || 0],
          ['Overall Pass Rate', data.overallPassRate || 0],
        ],
      },
      {
        heading: 'Subjects',
        rows,
        bullets: (data.subjects || [])
          .slice(0, 15)
          .map(
            (row: any) =>
              `${row.subjectName} (${row.className}) syllabus ${Number(row.syllabusCompletion || 0).toFixed(2)}%, on-time submissions ${row.submissionsOnTime || 0}, late ${row.submissionsLate || 0}`,
          ),
      },
      {
        heading: 'Term Trend',
        rows: [['Trend Points', (data.termTrend || []).length]],
        bullets: (data.termTrend || []).map((row: any) => `${row.term}: avg ${Number(row.average || 0).toFixed(2)}, pass ${Number(row.passRate || 0).toFixed(2)}%`),
      },
    ]);
  }
}
