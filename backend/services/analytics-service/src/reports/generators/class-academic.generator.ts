import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class ClassAcademicGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, `Class Academic Report - ${data.className || 'Class'}`, [
      {
        heading: 'Class Summary',
        rows: [
          ['Class', data.className || 'N/A'],
          ['Stream', data.stream || 'N/A'],
          ['Student Count', data.studentCount || 0],
          ['Pass Rate', data.passRate || 0],
        ],
      },
      {
        heading: 'Grade Distribution',
        rows: Object.entries(data.gradeDistribution || {}).map(([grade, count]) => [grade, Number(count || 0)]),
      },
      {
        heading: 'Risk',
        rows: [
          ['At Risk Count', data.atRiskCount || 0],
          ['Critical Count', data.criticalCount || 0],
          ['Active Pairings', data.activePairings || 0],
        ],
        bullets: (data.termComparison || []).slice(-6).map((row: any) => `${row.term}: avg ${Number(row.average || 0).toFixed(2)}, pass ${Number(row.passRate || 0).toFixed(2)}%`),
      },
      {
        heading: 'Subjects & Rankings',
        rows: [
          ['Subjects Covered', (data.subjectSummaries || []).length],
          ['Ranking Entries', (data.overallRankings || []).length],
        ],
        bullets: [
          ...(data.subjectSummaries || [])
            .slice(0, 10)
            .map((row: any) => `${row.subjectName}: avg ${Number(row.average || 0).toFixed(2)}, pass ${Number(row.passRate || 0).toFixed(2)}%`),
          ...(data.overallRankings || [])
            .slice(0, 5)
            .map((row: any) => `Top ${row.rank}: ${row.studentName} (${Number(row.overallAverage || 0).toFixed(2)}, grade ${row.grade || 'N/A'})`),
        ],
      },
    ]);
  }
}
