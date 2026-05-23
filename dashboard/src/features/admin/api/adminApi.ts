export type AdminStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING';
export type ServiceState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export const adminUsers = [
  { id: 'usr-admin', name: 'System Admin', email: 'admin@ks.ac.tz', role: 'ADMIN', status: 'ACTIVE' as AdminStatus, linked: 'System', lastLogin: '2026-05-21T08:20:00Z', createdAt: '2026-01-03T10:00:00Z' },
  { id: 'usr-principal', name: 'David Mwasimba', email: 'david.mwasimba@ks.ac.tz', role: 'PRINCIPAL', status: 'ACTIVE' as AdminStatus, linked: 'Principal Office', lastLogin: '2026-05-21T07:44:00Z', createdAt: '2026-01-04T10:00:00Z' },
  { id: 'usr-finance', name: 'Grace Temba', email: 'grace.temba@ks.ac.tz', role: 'FINANCE', status: 'LOCKED' as AdminStatus, linked: 'Finance Office', lastLogin: '2026-05-20T16:40:00Z', createdAt: '2026-01-05T10:00:00Z' },
  { id: 'usr-teacher', name: 'Amina Rashidi', email: 'amina.rashidi@ks.ac.tz', role: 'TEACHER', status: 'ACTIVE' as AdminStatus, linked: 'Science Department', lastLogin: '2026-05-21T06:52:00Z', createdAt: '2026-01-06T10:00:00Z' },
];

export const adminStudents = [
  { id: 'stu-amina', registration: 'KS-2026-00017', name: 'Amina Baraka Juma', className: 'Form 2A', stage: 'O-Level', status: 'ACTIVE', guardians: 2, linked: true, balance: 400000, risk: 'WATCH' },
  { id: 'stu-jabir', registration: 'KS-2026-00092', name: 'Jabir Hassan', className: 'Form 3B', stage: 'O-Level', status: 'ACTIVE', guardians: 1, linked: true, balance: 1450000, risk: 'CRITICAL' },
  { id: 'stu-zahara', registration: 'KS-2026-00058', name: 'Zahara Mushi', className: 'Form 4A', stage: 'O-Level', status: 'ACTIVE', guardians: 2, linked: true, balance: 0, risk: 'IMPROVING' },
  { id: 'stu-mariam', registration: 'KS-2026-00142', name: 'Mariam Kileo', className: 'Class 6A', stage: 'Primary', status: 'ACTIVE', guardians: 2, linked: true, balance: 120000, risk: 'STABLE' },
  { id: 'stu-isaac', registration: 'KS-2026-00211', name: 'Isaac Mollel', className: 'Form 5 PCM', stage: 'A-Level', status: 'ACTIVE', guardians: 1, linked: true, balance: 620000, risk: 'IMPROVING' },
];

export const adminClasses = [
  { id: 'class-1a', name: 'Class 1A', level: 'Class 1', numericLevel: 1, stage: 'Primary', curriculum: 'NECTA Primary', students: 34, teacher: 'Rehema Paul', year: '2026', status: 'ACTIVE', pathway: 'Class 2A', terminal: false, stream: 'A' },
  { id: 'class-6a', name: 'Class 6A', level: 'Class 6', numericLevel: 6, stage: 'Primary', curriculum: 'NECTA Primary', students: 36, teacher: 'Mariam Saidi', year: '2026', status: 'ACTIVE', pathway: 'Form 1A', terminal: true, stream: 'A' },
  { id: 'form-2a', name: 'Form 2A', level: 'Form 2', numericLevel: 2, stage: 'O-Level', curriculum: 'NECTA O-Level', students: 38, teacher: 'Neema John', year: '2026', status: 'ACTIVE', pathway: 'Form 3A', terminal: false, stream: 'A' },
  { id: 'form-4a', name: 'Form 4A', level: 'Form 4', numericLevel: 4, stage: 'O-Level', curriculum: 'NECTA O-Level', students: 39, teacher: 'Joseph Mrema', year: '2026', status: 'ACTIVE', pathway: 'A-Level selection', terminal: true, stream: 'A' },
  { id: 'form-5-pcm', name: 'Form 5 PCM', level: 'Form 5', numericLevel: 5, stage: 'A-Level', curriculum: 'NECTA A-Level', students: 24, teacher: 'Amina Rashidi', year: '2026', status: 'ACTIVE', pathway: 'Form 6 PCM', terminal: false, stream: 'PCM' },
  { id: 'form-6-pcb', name: 'Form 6 PCB', level: 'Form 6', numericLevel: 6, stage: 'A-Level', curriculum: 'NECTA A-Level', students: 21, teacher: 'Peter Sanga', year: '2026', status: 'ACTIVE', pathway: 'Graduation', terminal: true, stream: 'PCB' },
];

export const adminSubjects = [
  { id: 'english-primary', name: 'English', code: 'ENG-P', stage: 'Primary', department: 'Languages', status: 'ACTIVE', classes: 6, teachers: 2 },
  { id: 'chemistry', name: 'Chemistry', code: 'CHEM', stage: 'O-Level', department: 'Science', status: 'ACTIVE', classes: 5, teachers: 3 },
  { id: 'physics', name: 'Physics', code: 'PHY', stage: 'A-Level', department: 'Science', status: 'ACTIVE', classes: 4, teachers: 2 },
  { id: 'mathematics', name: 'Mathematics', code: 'MATH', stage: 'All stages', department: 'Mathematics', status: 'ACTIVE', classes: 10, teachers: 4 },
];

export const classPathways = [
  { id: 'pw-primary', from: 'Class 6A', to: 'Form 1A', type: 'Cross-stage', rule: 'Primary completion to O-Level intake' },
  { id: 'pw-olevel', from: 'Form 4A', to: 'Form 5 PCM/PCB/EGM', type: 'Cross-stage', rule: 'Combination placement after O-Level results' },
  { id: 'pw-alevel', from: 'Form 6 PCB', to: 'Graduation', type: 'Graduation', rule: 'Terminal A-Level class' },
];

export const subjectCombinations = [
  { id: 'combo-pcm', code: 'PCM', name: 'Physics, Chemistry, Mathematics', stage: 'A-Level', subjects: 'Physics, Chemistry, Mathematics', students: 24, principal: 'Physics, Chemistry, Mathematics', subsidiary: 'General Studies' },
  { id: 'combo-pcb', code: 'PCB', name: 'Physics, Chemistry, Biology', stage: 'A-Level', subjects: 'Physics, Chemistry, Biology', students: 21, principal: 'Physics, Chemistry, Biology', subsidiary: 'General Studies' },
  { id: 'combo-egm', code: 'EGM', name: 'Economics, Geography, Mathematics', stage: 'A-Level', subjects: 'Economics, Geography, Mathematics', students: 18, principal: 'Economics, Geography, Mathematics', subsidiary: 'General Studies' },
];

export const mixedSchoolApiContracts = [
  { method: 'POST', path: '/students/classes', purpose: 'Create Primary/O-Level/A-Level class with stage validation' },
  { method: 'PATCH', path: '/students/classes/:id', purpose: 'Edit class stage, level, terminal year and teacher' },
  { method: 'POST', path: '/students/class-pathways', purpose: 'Create promotion/cross-stage/graduation pathway' },
  { method: 'POST', path: '/students/promotions/bulk', purpose: 'Bulk promote students from configured pathway' },
  { method: 'POST', path: '/academics/subject-combinations', purpose: 'Create A-Level combination' },
  { method: 'POST', path: '/academics/student-subject-enrollments/bulk-combination', purpose: 'Assign Form 5/6 students to all combination subjects' },
  { method: 'POST', path: '/finance/fee-structures/student-groups', purpose: 'Create formal billing group' },
];

export const gradingScales = [
  { id: 'scale-primary-2026', name: 'Primary Standard 2026', scope: 'Primary Classes 1-6', active: true, boundaries: [{ label: 'A', min: 80, max: 100 }, { label: 'B', min: 65, max: 79 }, { label: 'C', min: 50, max: 64 }, { label: 'D', min: 35, max: 49 }, { label: 'F', min: 0, max: 34 }] },
  { id: 'scale-olevel-2026', name: 'O-Level Standard 2026', scope: 'Forms 1-4', active: true, boundaries: [{ label: 'A', min: 80, max: 100 }, { label: 'B', min: 65, max: 79 }, { label: 'C', min: 50, max: 64 }, { label: 'D', min: 35, max: 49 }, { label: 'F', min: 0, max: 34 }] },
  { id: 'scale-alevel-2026', name: 'A-Level Principal 2026', scope: 'Forms 5-6 combinations', active: false, boundaries: [{ label: 'A', min: 75, max: 100 }, { label: 'B', min: 65, max: 74 }, { label: 'C', min: 55, max: 64 }, { label: 'D', min: 45, max: 54 }, { label: 'S', min: 35, max: 44 }, { label: 'F', min: 0, max: 34 }] },
];

export const assessmentTypes = [
  { id: 'primary-weekly', name: 'Weekly Work', weight: 20, maxScore: 100, scope: 'Primary' },
  { id: 'cat', name: 'CAT', weight: 20, maxScore: 100, scope: 'O-Level' },
  { id: 'midterm', name: 'Midterm', weight: 30, maxScore: 100, scope: 'O-Level' },
  { id: 'final', name: 'Final', weight: 50, maxScore: 100, scope: 'O-Level' },
  { id: 'alevel-paper', name: 'A-Level Paper', weight: 50, maxScore: 100, scope: 'A-Level / subject-specific' },
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
