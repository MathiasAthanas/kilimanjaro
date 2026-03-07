import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class PerformanceEngineGenerator {
  async generate(filePath: string, data: any) {
    const alertTypeBullets = Object.entries(data.alertsSummary?.byType || {}).map(([type, count]) => `${type}: ${count}`);
    const alertSeverityBullets = Object.entries(data.alertsSummary?.bySeverity || {}).map(([severity, count]) => `${severity}: ${count}`);
    const interventionBullets = Object.entries(data.interventionSummary?.byType || {}).map(([type, count]) => `${type}: ${count}`);
    await createPdf(filePath, 'Performance Engine Report', [
      {
        heading: 'Alerts Summary',
        rows: [
          ['Total Alerts', data.alertsSummary?.totalAlerts ?? 0],
          ['Resolved', data.alertsSummary?.resolvedCount ?? 0],
          ['Unresolved', data.alertsSummary?.unresolvedCount ?? 0],
          ['Resolution Rate', data.alertsSummary?.resolutionRate ?? 0],
          ['Average Resolution Days', data.alertsSummary?.averageResolutionDays ?? 0],
        ],
        bullets: [...alertTypeBullets, ...alertSeverityBullets],
      },
      {
        heading: 'Pairing Summary',
        rows: [
          ['Total Suggested', data.pairingSummary?.totalSuggested ?? 0],
          ['Activated', data.pairingSummary?.activated ?? 0],
          ['Rejected', data.pairingSummary?.rejected ?? 0],
          ['Completed', data.pairingSummary?.completed ?? 0],
          ['Expired', data.pairingSummary?.expired ?? 0],
          ['Activation Rate', data.pairingSummary?.activationRate ?? 0],
          ['Effectiveness', data.pairingSummary?.effectivenessRate ?? 0],
          ['Positive Outcomes', data.pairingSummary?.positiveOutcomeCount ?? 0],
          ['Negative Outcomes', data.pairingSummary?.negativeOutcomeCount ?? 0],
          ['Avg Score Improvement', data.pairingSummary?.averageScoreImprovement ?? 0],
        ],
      },
      {
        heading: 'Interventions & Hotspots',
        rows: [
          ['Total Interventions', data.interventionSummary?.totalInterventions ?? 0],
          ['Followed Up', data.interventionSummary?.followedUpCount ?? 0],
          ['Follow-Up Rate', data.interventionSummary?.followUpRate ?? 0],
          ['Most Alerted Subjects', (data.mostAlertedSubjects || []).length],
          ['Chronic Underperformers', (data.chronicUnderperformers || []).length],
        ],
        bullets: [
          ...interventionBullets,
          ...(data.mostAlertedSubjects || []).slice(0, 10).map((row: any) => `${row.subjectName}: ${row.alertCount || 0} alerts, ${row.resolvedCount || 0} resolved`),
          ...(data.chronicUnderperformers || []).slice(0, 10).map((row: any) => `${row.studentName}: ${row.subjectCount || 0} active concern subjects`),
        ],
      },
      {
        heading: 'Success Stories',
        rows: [['Total Success Stories', (data.successStories || []).length]],
        bullets: (data.successStories || [])
          .slice(0, 10)
          .map((row: any) => `${row.studentName} ${row.subjectName ? `in ${row.subjectName}` : ''}: ${Number(row.improvement || 0).toFixed(2)} points`),
      },
    ]);
  }
}
