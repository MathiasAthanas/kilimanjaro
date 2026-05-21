import type {
  DisciplineIncident,
  MarkRow,
  PrincipalAssessment,
  PrincipalAuditEvent,
  PrincipalPaymentApproval,
  PrincipalStudent,
  PublishClass,
  SchoolHealth,
  StaffMember,
} from '../types/principal.types';

export const schoolHealth: SchoolHealth = {
  score: 78,
  academic: 74,
  finance: 73,
  operations: 86,
  trend: 4,
};

export const principalAssessments: PrincipalAssessment[] = [
  { id: 'assess-chem-3b-midterm', assessment: 'Chemistry Mid-Term', subject: 'Chemistry', className: 'Form 3B', teacher: 'Amina Rashidi', hodStatus: 'READY', average: 54.1, criticalAlerts: 3, age: 'HOD approved 18h ago', principalStatus: 'PENDING' },
  { id: 'assess-physics-4a-cat', assessment: 'Physics CAT 2', subject: 'Physics', className: 'Form 4A', teacher: 'Joseph Mrema', hodStatus: 'READY', average: 78.2, criticalAlerts: 1, age: 'HOD approved 9h ago', principalStatus: 'PENDING' },
  { id: 'assess-bio-2a-practical', assessment: 'Biology Practical', subject: 'Biology', className: 'Form 2A', teacher: 'Neema John', hodStatus: 'READY', average: 82.4, criticalAlerts: 0, age: 'HOD approved 2h ago', principalStatus: 'PENDING' },
];

export const markRows: MarkRow[] = [
  { student: 'Hassan Mwamba', registration: 'KS-2026-00121', score: 28, previous: 61, alert: 'Critical decline' },
  { student: 'Zainab Kilio', registration: 'KS-2026-00122', score: 34, previous: 54, alert: 'Below failure rail' },
  { student: 'Rehema Juma', registration: 'KS-2026-00123', score: 37, previous: 66, alert: 'At-risk escalation' },
  { student: 'Joel Komba', registration: 'KS-2026-00044', score: 94, previous: 88, alert: 'Top performer' },
  { student: 'Zahara Mushi', registration: 'KS-2026-00058', score: 81, previous: 76, alert: 'Stable' },
];

export const publishClasses: PublishClass[] = [
  { id: 'form-2a', className: 'Form 2A', students: 38, lockedAssessments: 9, missingItems: 0, reportCardReadiness: 92 },
  { id: 'form-3b', className: 'Form 3B', students: 42, lockedAssessments: 8, missingItems: 1, reportCardReadiness: 78 },
  { id: 'form-4a', className: 'Form 4A', students: 39, lockedAssessments: 10, missingItems: 0, reportCardReadiness: 96 },
];

export const paymentApprovals: PrincipalPaymentApproval[] = [
  { id: 'approval-pay-9002', paymentId: 'PAY-9002', student: 'Amina Baraka Juma', invoice: 'INV-2026-0001', method: 'BANK', amount: 800_000, reference: 'CRDB-8841', enteredBy: 'Grace Temba', age: '2h 18m', risk: 'high' },
  { id: 'approval-pay-9011', paymentId: 'PAY-9011', student: 'Jabir Hassan', invoice: 'INV-2026-0002', method: 'CASH', amount: 450_000, reference: 'FD-02 / Cash drawer', enteredBy: 'Grace Temba', age: '4h 02m', risk: 'medium' },
  { id: 'approval-pay-9014', paymentId: 'PAY-9014', student: 'Pendo Shayo', invoice: 'INV-2026-0034', method: 'BANK', amount: 1_100_000, reference: 'NMB-2217', enteredBy: 'Grace Temba', age: '7h 40m', risk: 'critical' },
];

export const principalStudents: PrincipalStudent[] = [
  { id: 'stu-hassan', name: 'Hassan Mwamba', className: 'Form 3B', academicAverage: 44, attendance: 88, financeBalance: 620_000, alertStatus: 'Critical', disciplineStatus: 'Open', guardian: '+255 712 000 118' },
  { id: 'stu-zainab', name: 'Zainab Kilio', className: 'Form 3B', academicAverage: 49, attendance: 91, financeBalance: 0, alertStatus: 'Critical', disciplineStatus: 'Clear', guardian: '+255 712 000 119' },
  { id: 'stu-amina', name: 'Amina Baraka Juma', className: 'Form 2A', academicAverage: 72, attendance: 96, financeBalance: 400_000, alertStatus: 'Watch', disciplineStatus: 'Clear', guardian: '+255 712 000 120' },
  { id: 'stu-zahara', name: 'Zahara Mushi', className: 'Form 4A', academicAverage: 84, attendance: 98, financeBalance: 0, alertStatus: 'Improving', disciplineStatus: 'Clear', guardian: '+255 712 000 121' },
];

export const disciplineIncidents: DisciplineIncident[] = [
  { id: 'disc-001', student: 'Hassan Mwamba', className: 'Form 3B', category: 'Repeated absence', severity: 'high', date: 'May 20, 2026', description: 'Three unexplained afternoon absences this week.', status: 'OPEN' },
  { id: 'disc-002', student: 'Kelvin Msuya', className: 'Form 4B', category: 'Conduct', severity: 'critical', date: 'May 19, 2026', description: 'Dormitory incident requiring guardian conference.', status: 'OPEN' },
  { id: 'disc-003', student: 'Rehema Juma', className: 'Form 3B', category: 'Late arrival', severity: 'medium', date: 'May 18, 2026', description: 'Recurring late arrival pattern; class teacher notified.', status: 'RESOLVED' },
];

export const staffMembers: StaffMember[] = [
  { id: 'teacher-amina', name: 'Amina Rashidi', role: 'Teacher', department: 'Science', onTime: 42, syllabus: 45, classes: 4 },
  { id: 'teacher-joseph', name: 'Joseph Mrema', role: 'Teacher', department: 'Science', onTime: 92, syllabus: 84, classes: 3 },
  { id: 'hod-james', name: 'Dr. James Kileo', role: 'HOD', department: 'Science', onTime: 88, syllabus: 79, classes: 0 },
  { id: 'teacher-rose', name: 'Rose Mhina', role: 'Teacher', department: 'Mathematics', onTime: 76, syllabus: 62, classes: 5 },
  { id: 'finance-grace', name: 'Grace Temba', role: 'Finance', department: 'Finance', onTime: 95, syllabus: 0, classes: 0 },
];

export const principalAudit: PrincipalAuditEvent[] = [
  { id: 'pa-001', date: 'May 21, 2026 11:02', actor: 'Mr. David Mwasimba', decision: 'Payment approved', entity: 'PAY-8998', reason: 'Bank reference verified against statement.', correlationId: 'PRN-2026-7401' },
  { id: 'pa-002', date: 'May 21, 2026 09:40', actor: 'Mr. David Mwasimba', decision: 'Marks returned', entity: 'Chemistry CAT 1', reason: 'Low outlier required teacher explanation.', correlationId: 'PRN-2026-7398' },
  { id: 'pa-003', date: 'May 20, 2026 16:12', actor: 'Mr. David Mwasimba', decision: 'Announcement published', entity: 'Parent meeting notice', reason: 'Whole-school communication approved.', correlationId: 'PRN-2026-7371' },
];

export const principalApi = {
  getSchoolHealth: async () => schoolHealth,
  getAssessments: async () => principalAssessments,
  getMarks: async () => markRows,
  getPublishClasses: async () => publishClasses,
  getPaymentApprovals: async () => paymentApprovals,
  getStudents: async () => principalStudents,
  getDiscipline: async () => disciplineIncidents,
  getStaff: async () => staffMembers,
  getAudit: async () => principalAudit,
};
