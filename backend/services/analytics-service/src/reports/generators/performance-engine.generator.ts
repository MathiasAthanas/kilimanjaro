import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class PerformanceEngineGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'Performance Engine Report', [
      {
        heading: 'Alerts Summary',
        rows: [
          ['Total Alerts', data.alertsSummary?.totalAlerts ?? 0],
          ['Resolved', data.alertsSummary?.resolvedCount ?? 0],
          ['Unresolved', data.alertsSummary?.unresolvedCount ?? 0],
          ['Resolution Rate', data.alertsSummary?.resolutionRate ?? 0],
        ],
      },
      {
        heading: 'Pairing Summary',
        rows: [
          ['Total Suggested', data.pairingSummary?.totalSuggested ?? 0],
          ['Completed', data.pairingSummary?.completed ?? 0],
          ['Effectiveness', data.pairingSummary?.effectivenessRate ?? 0],
        ],
      },
    ]);
  }
}
