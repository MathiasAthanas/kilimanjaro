export type HodApproval = {
  id: string;
  subject: string;
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUBMITTED';
  riskFlags: string[];
};

export type HodSubject = {
  id: string;
  name: string;
  average: number;
  change: number;
  atRisk: number;
  syllabus: number;
  alerts: number;
  teacher: string;
  assessments: number;
  studentsAssessed: number;
  pending: number;
  gradeDistribution: Record<string, number>;
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
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POSITIVE';
  alertType: string;
  currentScore: number | null;
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
  mentorScore: number | null;
  supportScore: number | null;
};

export type HodIntervention = {
  id: string;
  subject: string;
  className: string;
  teacher: string;
  student: string;
  type: string;
  note: string;
  status: 'FOLLOW_UP_REQUIRED' | 'COMPLETED' | 'OPEN' | 'IN_PROGRESS';
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
