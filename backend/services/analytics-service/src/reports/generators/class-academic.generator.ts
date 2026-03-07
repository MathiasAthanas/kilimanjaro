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
        heading: 'Risk',
        rows: [
          ['At Risk Count', data.atRiskCount || 0],
          ['Critical Count', data.criticalCount || 0],
          ['Active Pairings', data.activePairings || 0],
        ],
      },
    ]);
  }
}
