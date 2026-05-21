import type { AqaAlert, AqaIntervention, AqaPairing, AqaReport, HeatmapCell, Threshold } from '../types/aqa.types';

export const aqaAlerts: AqaAlert[] = [
  { id: 'alert-jabir-chem', studentId: 'stu-jabir', student: 'Jabir Hassan', className: 'Form 3B', subject: 'Chemistry', teacher: 'Amina Rashidi', hod: 'Dr. James Kileo', type: 'SUDDEN_DECLINE', severity: 'CRITICAL', currentScore: 39, change: -32, evidence: 'Dropped from 71% to 39% over two assessments.', pairingStatus: 'SUGGESTED', interventionStatus: 'OPEN' },
  { id: 'alert-john-math', studentId: 'stu-john', student: 'John Mwangi', className: 'Form 4A', subject: 'Mathematics', teacher: 'Rose Mhina', hod: 'Dr. James Kileo', type: 'SUDDEN_DECLINE', severity: 'CRITICAL', currentScore: 41, change: -28, evidence: 'Mock exam score dropped below failure rail.', pairingStatus: 'NONE', interventionStatus: 'NONE' },
  { id: 'alert-pendo-math', studentId: 'stu-pendo', student: 'Pendo Shayo', className: 'Form 2B', subject: 'Mathematics', teacher: 'Rose Mhina', hod: 'Dr. James Kileo', type: 'CHRONIC_UNDERPERFORMER', severity: 'HIGH', currentScore: 44, change: -7, evidence: 'Below at-risk threshold for three consecutive terms.', pairingStatus: 'ACTIVE', interventionStatus: 'FOLLOW_UP' },
  { id: 'alert-amina-bio', studentId: 'stu-amina', student: 'Amina Baraka Juma', className: 'Form 2A', subject: 'Biology', teacher: 'Neema John', hod: 'Dr. James Kileo', type: 'AT_RISK', severity: 'MEDIUM', currentScore: 58, change: -9, evidence: 'Biology practical below class median.', pairingStatus: 'SUGGESTED', interventionStatus: 'OPEN' },
  { id: 'alert-zahara-physics', studentId: 'stu-zahara', student: 'Zahara Mushi', className: 'Form 4A', subject: 'Physics', teacher: 'Joseph Mrema', hod: 'Dr. James Kileo', type: 'RECOVERY', severity: 'POSITIVE', currentScore: 84, change: 18, evidence: 'Recovered after peer support activation.', pairingStatus: 'ACTIVE', interventionStatus: 'COMPLETED' as AqaAlert['interventionStatus'] },
];

export const heatmap: HeatmapCell[] = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'English'].flatMap((subject) =>
  ['Form 1A', 'Form 2A', 'Form 3B', 'Form 4A', 'Form 4B'].map((className, index) => {
    const chemistryPenalty = subject === 'Chemistry' ? 18 : 0;
    const mathPenalty = subject === 'Mathematics' && index > 2 ? 14 : 0;
    const average = 82 - index * 3 - chemistryPenalty - mathPenalty;
    return { subject, classId: className.toLowerCase().replaceAll(' ', '-'), className, average, alerts: average < 60 ? 3 : average < 70 ? 1 : 0 };
  }),
);

export const pairings: AqaPairing[] = [
  { id: 'pair-jabir-joel', support: 'Jabir Hassan', mentor: 'Joel Komba', className: 'Form 3B', subject: 'Chemistry', scoreGap: 34, reason: 'Organic chemistry gap and compatible timetable.', status: 'SUGGESTED', teacher: 'Amina Rashidi', outcome: 'Pending' },
  { id: 'pair-amina-zahara', support: 'Amina Baraka Juma', mentor: 'Zahara Mushi', className: 'Form 2A', subject: 'Biology', scoreGap: 22, reason: 'Practical lab skill support.', status: 'SUGGESTED', teacher: 'Neema John', outcome: 'Pending' },
  { id: 'pair-pendo-emmanuel', support: 'Pendo Shayo', mentor: 'Emmanuel John', className: 'Form 2B', subject: 'Mathematics', scoreGap: 29, reason: 'Chronic underperformance support.', status: 'ACTIVE', teacher: 'Rose Mhina', outcome: '+7% after 2 weeks' },
];

export const interventions: AqaIntervention[] = [
  { id: 'int-jabir', student: 'Jabir Hassan', subject: 'Chemistry', className: 'Form 3B', roleOwner: 'HOD', type: 'Concept clinic', status: 'FOLLOW_UP_REQUIRED', week: 'This week', note: 'HOD review and lab record audit required.' },
  { id: 'int-john', student: 'John Mwangi', subject: 'Mathematics', className: 'Form 4A', roleOwner: 'Teacher', type: 'Revision plan', status: 'OPEN', week: 'This week', note: 'Teacher to submit weekly progress notes.' },
  { id: 'int-zahara', student: 'Zahara Mushi', subject: 'Physics', className: 'Form 4A', roleOwner: 'AQA', type: 'Recovery validation', status: 'COMPLETED', week: 'Last week', note: 'Positive outcome recorded after pairing.' },
];

export const reports: AqaReport[] = [
  { id: 'rep-school-overview', title: 'School Academic Overview', type: 'School Overview', status: 'READY', generatedAt: 'Today 08:10' },
  { id: 'rep-engine', title: 'Performance Engine Run', type: 'Performance Engine', status: 'GENERATING', generatedAt: 'Now' },
  { id: 'rep-at-risk', title: 'At-Risk Students Register', type: 'At-Risk Students', status: 'READY', generatedAt: 'Yesterday' },
];

export const thresholds: Threshold[] = [
  { id: 'failure', label: 'Critical Failure Threshold', value: 35, min: 0, max: 100, tone: 'rose', description: 'Scores below this line become critical failures.' },
  { id: 'atrisk', label: 'At-Risk Warning Range', value: 48, min: 0, max: 100, tone: 'amber', description: 'Students below this score enter monitoring.' },
  { id: 'excellence', label: 'Excellence Benchmark', value: 85, min: 0, max: 100, tone: 'emerald', description: 'High achievers and merit candidates.' },
  { id: 'decline', label: 'Sudden Decline Threshold', value: 15, min: 0, max: 50, tone: 'blue', description: 'Point drop needed to trigger decline alerts.' },
];

export const aqaApi = {
  getAlerts: async () => aqaAlerts,
  getHeatmap: async () => heatmap,
  getPairings: async () => pairings,
  getInterventions: async () => interventions,
  getReports: async () => reports,
  getThresholds: async () => thresholds,
};
