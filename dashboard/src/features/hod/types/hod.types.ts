export type HodApproval = {
  id: string;
  subject: 'Biology' | 'Chemistry' | 'Physics';
  className: string;
  assessment: string;
  type: string;
  teacher: string;
  teacherId: string;
  submittedHoursAgo: number;
  students: number;
  marked: number;
  average: number;
  highest: number;
  lowest: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  riskFlags: string[];
};

export type HodSubject = {
  id: string;
  name: 'Biology' | 'Chemistry' | 'Physics';
  average: number;
  change: number;
  atRisk: number;
  syllabus: number;
  alerts: number;
  teacher: string;
  tone: 'emerald' | 'rose' | 'amber' | 'blue';
};

export type HodTeacher = {
  id: string;
  name: string;
  subjects: string;
  average: number;
  onTime: number;
  syllabus: number;
  atRisk: number;
  pending: number;
  rejections: number;
};

export type HodAlert = {
  id: string;
  studentId: string;
  student: string;
  subject: string;
  className: string;
  severity: 'CRITICAL' | 'WATCH' | 'IMPROVING';
  reason: string;
  action: string;
};

export type HodPairing = {
  id: string;
  mentor: string;
  support: string;
  subject: string;
  className: string;
  status: 'SUGGESTED' | 'ACTIVE' | 'COMPLETED';
  benefit: string;
};

export type HodIntervention = {
  id: string;
  subject: string;
  className: string;
  teacher: string;
  student: string;
  type: string;
  note: string;
  status: 'FOLLOW_UP_REQUIRED' | 'COMPLETED';
  age: string;
};

export type HodMarkRow = {
  student: string;
  registration: string;
  score: number | null;
  maxScore: number;
  absent: boolean;
  note: string;
};
