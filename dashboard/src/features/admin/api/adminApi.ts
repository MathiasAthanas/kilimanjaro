export type AdminStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING';
export type ServiceState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export const adminUsers = [
  { id: 'usr-admin', name: 'System Admin', email: 'admin@ks.ac.tz', role: 'ADMIN', status: 'ACTIVE' as AdminStatus, linked: 'System', lastLogin: '2026-05-21T08:20:00Z', createdAt: '2026-01-03T10:00:00Z' },
  { id: 'usr-principal', name: 'David Mwasimba', email: 'david.mwasimba@ks.ac.tz', role: 'PRINCIPAL', status: 'ACTIVE' as AdminStatus, linked: 'Principal Office', lastLogin: '2026-05-21T07:44:00Z', createdAt: '2026-01-04T10:00:00Z' },
  { id: 'usr-finance', name: 'Grace Temba', email: 'grace.temba@ks.ac.tz', role: 'FINANCE', status: 'LOCKED' as AdminStatus, linked: 'Finance Office', lastLogin: '2026-05-20T16:40:00Z', createdAt: '2026-01-05T10:00:00Z' },
  { id: 'usr-teacher', name: 'Amina Rashidi', email: 'amina.rashidi@ks.ac.tz', role: 'TEACHER', status: 'ACTIVE' as AdminStatus, linked: 'Science Department', lastLogin: '2026-05-21T06:52:00Z', createdAt: '2026-01-06T10:00:00Z' },
];

export const adminStudents = [
  { id: 'stu-amina', registration: 'KS-2026-00017', name: 'Amina Baraka Juma', className: 'Form 2A', status: 'ACTIVE', guardians: 2, linked: true, balance: 400000, risk: 'WATCH' },
  { id: 'stu-jabir', registration: 'KS-2026-00092', name: 'Jabir Hassan', className: 'Form 3B', status: 'ACTIVE', guardians: 1, linked: true, balance: 1450000, risk: 'CRITICAL' },
  { id: 'stu-zahara', registration: 'KS-2026-00058', name: 'Zahara Mushi', className: 'Form 4A', status: 'ACTIVE', guardians: 2, linked: true, balance: 0, risk: 'IMPROVING' },
];

export const adminClasses = [
  { id: 'form-2a', name: 'Form 2A', level: 'Form 2', students: 38, teacher: 'Neema John', year: '2026', status: 'ACTIVE' },
  { id: 'form-3b', name: 'Form 3B', level: 'Form 3', students: 42, teacher: 'Amina Rashidi', year: '2026', status: 'ACTIVE' },
  { id: 'form-4a', name: 'Form 4A', level: 'Form 4', students: 39, teacher: 'Joseph Mrema', year: '2026', status: 'ACTIVE' },
];

export const adminSubjects = [
  { id: 'chemistry', name: 'Chemistry', code: 'CHEM', department: 'Science', status: 'ACTIVE', classes: 5, teachers: 3 },
  { id: 'physics', name: 'Physics', code: 'PHY', department: 'Science', status: 'ACTIVE', classes: 4, teachers: 2 },
  { id: 'mathematics', name: 'Mathematics', code: 'MATH', department: 'Mathematics', status: 'ACTIVE', classes: 6, teachers: 4 },
];

export const gradingScales = [
  { id: 'scale-2026', name: 'Kilimanjaro Standard 2026', active: true, boundaries: [{ label: 'A', min: 80, max: 100 }, { label: 'B', min: 65, max: 79 }, { label: 'C', min: 50, max: 64 }, { label: 'D', min: 35, max: 49 }, { label: 'F', min: 0, max: 34 }] },
];

export const assessmentTypes = [
  { id: 'cat', name: 'CAT', weight: 20, maxScore: 100, scope: 'Term' },
  { id: 'midterm', name: 'Midterm', weight: 30, maxScore: 100, scope: 'Term' },
  { id: 'final', name: 'Final', weight: 50, maxScore: 100, scope: 'Term' },
];

export const serviceHealth = [
  { service: 'API Gateway', state: 'ONLINE' as ServiceState, uptime: '99.98%', latency: '42ms' },
  { service: 'Auth', state: 'ONLINE' as ServiceState, uptime: '99.95%', latency: '55ms' },
  { service: 'Student', state: 'ONLINE' as ServiceState, uptime: '99.91%', latency: '61ms' },
  { service: 'Academic', state: 'DEGRADED' as ServiceState, uptime: '98.70%', latency: '220ms' },
  { service: 'Finance', state: 'ONLINE' as ServiceState, uptime: '99.93%', latency: '66ms' },
  { service: 'Notification', state: 'DEGRADED' as ServiceState, uptime: '98.21%', latency: '310ms' },
  { service: 'Analytics', state: 'ONLINE' as ServiceState, uptime: '99.89%', latency: '75ms' },
  { service: 'Database', state: 'ONLINE' as ServiceState, uptime: '99.99%', latency: '18ms' },
  { service: 'Queue', state: 'ONLINE' as ServiceState, uptime: '99.90%', latency: '35ms' },
];

export const notificationTemplates = [
  { id: 'tpl-results', name: 'Results Published', channel: 'Push', eventType: 'RESULTS_PUBLISHED', status: 'ACTIVE', lastEdited: '2026-05-20T12:00:00Z', editor: 'System Admin', body: 'Hello {{student.name}}, your {{term.name}} results are ready.' },
  { id: 'tpl-fees', name: 'Fee Reminder', channel: 'SMS', eventType: 'FEE_REMINDER', status: 'ACTIVE', lastEdited: '2026-05-19T12:00:00Z', editor: 'Grace Temba', body: 'Dear {{guardian.name}}, balance is {{finance.balance}}.' },
];

export const notificationLogs = [
  { id: 'log-1', time: '2026-05-21T08:00:00Z', channel: 'SMS', recipient: '+255712000111', eventType: 'FEE_REMINDER', status: 'FAILED', attempts: 3, provider: 'Timeout' },
  { id: 'log-2', time: '2026-05-21T09:00:00Z', channel: 'Push', recipient: 'Amina', eventType: 'RESULTS_PUBLISHED', status: 'DELIVERED', attempts: 1, provider: 'FCM OK' },
];

export const adminAuditEvents = [
  { id: 'audit-1', time: '2026-05-21T09:15:00Z', actor: 'System Admin', action: 'USER_UNLOCKED', entity: 'Grace Temba', payload: { before: 'LOCKED', after: 'ACTIVE' } },
  { id: 'audit-2', time: '2026-05-21T10:21:00Z', actor: 'System Admin', action: 'TEMPLATE_UPDATED', entity: 'Fee Reminder', payload: { channel: 'SMS' } },
];

export const reportJobs = [
  { id: 'rpt-001', name: 'Finance Collection Summary', status: 'COMPLETED', requestedBy: 'Grace Temba', role: 'FINANCE', scope: 'Term II', format: 'PDF', created: '2026-05-21T08:10:00Z' },
  { id: 'rpt-002', name: 'Academic Overview', status: 'RUNNING', requestedBy: 'David Mwasimba', role: 'PRINCIPAL', scope: 'Whole School', format: 'XLSX', created: '2026-05-21T09:30:00Z' },
];

export const adminApi = {
  getUsers: async () => adminUsers,
  getStudents: async () => adminStudents,
  getClasses: async () => adminClasses,
  getSubjects: async () => adminSubjects,
  getGradingScales: async () => gradingScales,
  getAssessmentTypes: async () => assessmentTypes,
  getServiceHealth: async () => serviceHealth,
  getNotificationTemplates: async () => notificationTemplates,
  getNotificationLogs: async () => notificationLogs,
  getAudit: async () => adminAuditEvents,
  getReports: async () => reportJobs,
};
