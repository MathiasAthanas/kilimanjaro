import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { num, pct, words } from './report.format';

const countRows = (record: Record<string, unknown> | undefined) => Object.entries(record || {}).map(([key, count]) => [words(key), num(count)]);

@Injectable()
export class PerformanceEngineGenerator {
  async generate(filePath: string, data: any) {
    const unresolved = num(data.alertsSummary?.unresolvedCount);
    const followUpRate = num(data.interventionSummary?.followUpRate);
    const effectiveness = num(data.pairingSummary?.effectivenessRate);
    const managementActions = [
      unresolved > 0
        ? `${unresolved} unresolved alerts require named owners, target dates, and escalation criteria.`
        : 'No unresolved alerts are currently returned by the performance engine.',
      followUpRate < 75 && num(data.interventionSummary?.totalInterventions) > 0
        ? `Intervention follow-up is ${pct(followUpRate)}; HODs should audit interventions without follow-up dates.`
        : `Intervention follow-up rate is ${pct(followUpRate)}.`,
      effectiveness > 0
        ? `Peer pairing effectiveness is ${pct(effectiveness)}; continue monitoring completed outcomes.`
        : 'No positive peer pairing effectiveness is currently available for this period.',
    ];

    await createReport(filePath, 'Performance Engine Report', [
      {
        heading: 'AQA Management Actions',
        rows: [
          ['Unresolved Alerts', data.alertsSummary?.unresolvedCount ?? 0, 'int'],
          ['Resolution Rate', data.alertsSummary?.resolutionRate ?? 0, 'percent'],
          ['Follow-Up Rate', data.interventionSummary?.followUpRate ?? 0, 'percent'],
          ['Pairing Effectiveness', data.pairingSummary?.effectivenessRate ?? 0, 'percent'],
        ],
        bullets: managementActions,
      },
      {
        heading: 'Alerts Summary',
        rows: [
          ['Total Alerts', data.alertsSummary?.totalAlerts ?? 0, 'int'],
          ['Resolved', data.alertsSummary?.resolvedCount ?? 0, 'int'],
          ['Unresolved', data.alertsSummary?.unresolvedCount ?? 0, 'int'],
          ['Resolution Rate', data.alertsSummary?.resolutionRate ?? 0, 'percent'],
          ['Average Resolution Days', data.alertsSummary?.averageResolutionDays ?? 0, 'decimal'],
        ],
        tables: [
          { title: 'Alerts by type', columns: [{ header: 'Type' }, { header: 'Alerts', kind: 'int' }], rows: countRows(data.alertsSummary?.byType) },
          { title: 'Alerts by severity', columns: [{ header: 'Severity' }, { header: 'Alerts', kind: 'int' }], rows: countRows(data.alertsSummary?.bySeverity) },
        ],
      },
      {
        heading: 'Pairing Summary',
        rows: [
          ['Total Suggested', data.pairingSummary?.totalSuggested ?? 0, 'int'],
          ['Activated', data.pairingSummary?.activated ?? 0, 'int'],
          ['Rejected', data.pairingSummary?.rejected ?? 0, 'int'],
          ['Completed', data.pairingSummary?.completed ?? 0, 'int'],
          ['Expired', data.pairingSummary?.expired ?? 0, 'int'],
          ['Activation Rate', data.pairingSummary?.activationRate ?? 0, 'percent'],
          ['Effectiveness', data.pairingSummary?.effectivenessRate ?? 0, 'percent'],
          ['Positive Outcomes', data.pairingSummary?.positiveOutcomeCount ?? 0, 'int'],
          ['Negative Outcomes', data.pairingSummary?.negativeOutcomeCount ?? 0, 'int'],
          ['Avg Score Improvement (points)', data.pairingSummary?.averageScoreImprovement ?? 0, 'decimal'],
        ],
      },
      {
        heading: 'Interventions & Hotspots',
        rows: [
          ['Total Interventions', data.interventionSummary?.totalInterventions ?? 0, 'int'],
          ['Followed Up', data.interventionSummary?.followedUpCount ?? 0, 'int'],
          ['Follow-Up Rate', data.interventionSummary?.followUpRate ?? 0, 'percent'],
          ['Most Alerted Subjects', (data.mostAlertedSubjects || []).length, 'int'],
          ['Chronic Underperformers', (data.chronicUnderperformers || []).length, 'int'],
        ],
        tables: [
          { title: 'Interventions by type', columns: [{ header: 'Type' }, { header: 'Interventions', kind: 'int' }], rows: countRows(data.interventionSummary?.byType) },
          {
            title: 'Most alerted subjects',
            columns: [{ header: 'Subject' }, { header: 'Alerts', kind: 'int' }, { header: 'Resolved', kind: 'int' }],
            rows: (data.mostAlertedSubjects || []).map((row: any) => [row.subjectName, num(row.alertCount), num(row.resolvedCount)]),
          },
          {
            title: 'Chronic underperformers',
            columns: [{ header: 'Learner' }, { header: 'Subjects of concern', kind: 'int' }],
            rows: (data.chronicUnderperformers || []).map((row: any) => [row.studentName, num(row.subjectCount)]),
          },
        ],
      },
      {
        heading: 'Success Stories',
        rows: [['Total Success Stories', (data.successStories || []).length, 'int']],
        tables: [
          {
            columns: [{ header: 'Learner', weight: 2.2 }, { header: 'Subject' }, { header: 'Improvement (points)', kind: 'decimal' }],
            rows: (data.successStories || []).map((row: any) => [row.studentName, row.subjectName || '-', num(row.improvement)]),
          },
        ],
      },
    ]);
  }
}
