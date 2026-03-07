import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class TeacherPerformanceGenerator {
  async generate(filePath: string, data: any) {
    const rows = (data.subjects || []).map((row: any) => [
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
      { heading: 'Subjects', rows },
    ]);
  }
}
