export type AqaAlert = {
  id: string;
  studentId: string;
  student: string;
  className: string;
  subject: string;
  teacher: string;
  hod: string;
  type: 'SUDDEN_DECLINE' | 'AT_RISK' | 'CHRONIC_UNDERPERFORMER' | 'RECOVERY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POSITIVE';
  currentScore: number;
  change: number;
  evidence: string;
  pairingStatus: 'NONE' | 'SUGGESTED' | 'ACTIVE';
  interventionStatus: 'NONE' | 'OPEN' | 'FOLLOW_UP';
};

export type HeatmapCell = {
  subject: string;
  classId: string;
  className: string;
  average: number;
  alerts: number;
};

export type AqaPairing = {
  id: string;
  support: string;
  mentor: string;
  className: string;
  subject: string;
  scoreGap: number;
  reason: string;
  status: 'SUGGESTED' | 'ACTIVE' | 'COMPLETED';
  teacher: string;
  outcome: string;
};

export type AqaIntervention = {
  id: string;
  student: string;
  subject: string;
  className: string;
  roleOwner: 'Teacher' | 'HOD' | 'AQA';
  type: string;
  status: 'FOLLOW_UP_REQUIRED' | 'OPEN' | 'COMPLETED';
  week: string;
  note: string;
};

export type AqaReport = {
  id: string;
  title: string;
  type: string;
  status: 'READY' | 'GENERATING' | 'FAILED';
  generatedAt: string;
};

export type Threshold = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  tone: 'rose' | 'amber' | 'emerald' | 'blue';
  description: string;
};
