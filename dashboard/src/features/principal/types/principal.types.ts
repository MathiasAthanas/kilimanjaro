export type DecisionStatus = 'PENDING' | 'READY' | 'LOCKED' | 'RETURNED' | 'PUBLISHED' | 'APPROVED' | 'REJECTED';

export type Urgency = 'critical' | 'high' | 'medium' | 'stable';

export type PrincipalMetric = {
  label: string;
  value: string;
  detail: string;
  tone: Urgency;
};

export type SchoolHealth = {
  score: number;
  academic: number;
  finance: number;
  operations: number;
  trend: number;
};

export type PrincipalAssessment = {
  id: string;
  assessment: string;
  subject: string;
  className: string;
  teacher: string;
  hodStatus: DecisionStatus;
  average: number;
  criticalAlerts: number;
  age: string;
  principalStatus: DecisionStatus;
};

export type MarkRow = {
  student: string;
  registration: string;
  score: number;
  previous: number;
  alert: string;
};

export type PublishClass = {
  id: string;
  className: string;
  students: number;
  lockedAssessments: number;
  missingItems: number;
  reportCardReadiness: number;
};

export type PrincipalPaymentApproval = {
  id: string;
  paymentId: string;
  student: string;
  invoice: string;
  method: 'CASH' | 'BANK' | 'MOBILE_MONEY';
  amount: number;
  reference: string;
  enteredBy: string;
  age: string;
  risk: Urgency;
};

export type PrincipalStudent = {
  id: string;
  name: string;
  className: string;
  academicAverage: number;
  attendance: number;
  financeBalance: number;
  alertStatus: string;
  disciplineStatus: string;
  guardian: string;
};

export type DisciplineIncident = {
  id: string;
  student: string;
  className: string;
  category: string;
  severity: Urgency;
  date: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
};

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  department: string;
  onTime: number;
  syllabus: number;
  classes: number;
};

export type PrincipalAuditEvent = {
  id: string;
  date: string;
  actor: string;
  decision: string;
  entity: string;
  reason: string;
  correlationId: string;
};
