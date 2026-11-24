import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { num } from './report.format';

@Injectable()
export class ClassAcademicGenerator {
  async generate(filePath: string, data: any) {
    const className = [data.className, data.stream].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const gradeEntries = Object.entries(data.gradeDistribution || {});
    await createReport(filePath, `Class Academic Report - ${className || 'Class'}`, [
      {
        heading: 'Class Summary',
        rows: [
          ['Class', data.className || 'N/A', 'text'],
          ['Stream', data.stream || 'N/A', 'text'],
          ['Student Count', data.studentCount || 0, 'int'],
          ['Pass Rate', data.passRate || 0, 'percent'],
        ],
        tables: [
          {
            title: 'Grade distribution',
            columns: [{ header: 'Grade' }, { header: 'Learners', kind: 'int' }],
            rows: gradeEntries.map(([grade, count]) => [grade, num(count)]),
          },
        ],
      },
      {
        heading: 'Risk',
        rows: [
          ['At Risk Count', data.atRiskCount || 0, 'int'],
          ['Critical Count', data.criticalCount || 0, 'int'],
          ['Active Pairings', data.activePairings || 0, 'int'],
        ],
        tables: [
          {
            title: 'Term comparison',
            columns: [{ header: 'Term' }, { header: 'Average', kind: 'decimal' }, { header: 'Pass rate %', kind: 'percent' }],
            rows: (data.termComparison || []).map((row: any) => [row.term, num(row.average), num(row.passRate)]),
          },
        ],
      },
      {
        heading: 'Subjects & Rankings',
        rows: [
          ['Subjects Covered', (data.subjectSummaries || []).length, 'int'],
          ['Ranking Entries', (data.overallRankings || []).length, 'int'],
        ],
        tables: [
          {
            title: 'Subject results',
            columns: [{ header: 'Subject' }, { header: 'Average', kind: 'decimal' }, { header: 'Pass rate %', kind: 'percent' }],
            rows: (data.subjectSummaries || []).map((row: any) => [row.subjectName, num(row.average), num(row.passRate)]),
          },
          {
            title: 'Overall ranking',
            columns: [{ header: 'Rank', kind: 'int', weight: 0.6 }, { header: 'Learner' }, { header: 'Average', kind: 'decimal' }, { header: 'Grade', kind: 'text', weight: 0.7 }],
            rows: (data.overallRankings || []).map((row: any) => [num(row.rank), row.studentName, num(row.overallAverage), row.grade || '-']),
          },
        ],
      },
    ]);
  }
}
