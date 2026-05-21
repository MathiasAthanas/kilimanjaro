export const reportCatalog = [
  { id: 'academic-overview', domain: 'Academic', title: 'Academic Overview', roles: ['AQA', 'PRINCIPAL', 'ADMIN'], sensitive: false },
  { id: 'finance-collection', domain: 'Finance', title: 'Collection Summary', roles: ['FINANCE', 'PRINCIPAL', 'ADMIN'], sensitive: true },
  { id: 'student-profile', domain: 'Student', title: 'Student Profile', roles: ['TEACHER', 'HOD', 'AQA', 'PRINCIPAL', 'ADMIN'], sensitive: true },
  { id: 'audit-export', domain: 'Audit', title: 'Audit Export', roles: ['PRINCIPAL', 'ADMIN'], sensitive: true },
];

export const reportJobs = [
  { id: 'job-7001', name: 'Academic Overview', status: 'COMPLETED', requestedBy: 'David Mwasimba', role: 'PRINCIPAL', scope: 'Whole School', format: 'PDF', created: '2026-05-21T08:00:00Z', expiry: '2026-05-28T08:00:00Z' },
  { id: 'job-7002', name: 'Fee Defaulters', status: 'RUNNING', requestedBy: 'Grace Temba', role: 'FINANCE', scope: 'Term II', format: 'CSV', created: '2026-05-21T09:12:00Z', expiry: 'Pending' },
  { id: 'job-7003', name: 'Notification Delivery', status: 'FAILED', requestedBy: 'System Admin', role: 'ADMIN', scope: 'This week', format: 'XLSX', created: '2026-05-21T09:30:00Z', expiry: 'None' },
];

export const bulkAssessments = [
  { id: 'assess-chem-3b-midterm', assessment: 'Chemistry Mid-Term', className: 'Form 3B', subject: 'Chemistry', type: 'Midterm', max: 100, status: 'DRAFT', teacher: 'Amina Rashidi', lastEdited: 'Today 08:12' },
  { id: 'assess-physics-4a-cat', assessment: 'Physics CAT 2', className: 'Form 4A', subject: 'Physics', type: 'CAT', max: 100, status: 'SUBMITTED', teacher: 'Joseph Mrema', lastEdited: 'Yesterday' },
];

export const bulkMarks = [
  { id: 'mk-1', student: 'Hassan Mwamba', registration: 'KS-2026-00121', score: 28, status: 'INVALID', error: 'Critical decline requires comment' },
  { id: 'mk-2', student: 'Zainab Kilio', registration: 'KS-2026-00122', score: 34, status: 'CLEAN', error: '' },
  { id: 'mk-3', student: 'Joel Komba', registration: 'KS-2026-00044', score: 94, status: 'SAVED', error: '' },
];

export const resultClasses = [
  { classId: 'form-2a', termId: 'term-ii', className: 'Form 2A', students: 38, status: 'READY', blockers: 0, readiness: 92 },
  { classId: 'form-3b', termId: 'term-ii', className: 'Form 3B', students: 42, status: 'BLOCKED', blockers: 3, readiness: 78 },
  { classId: 'form-4a', termId: 'term-ii', className: 'Form 4A', students: 39, status: 'READY', blockers: 0, readiness: 96 },
];

export const analyticsMetrics = [
  { label: 'Academic mean', value: '74.2%', source: '/analytics/academic/overview', insight: 'Chemistry remains the largest academic drag.' },
  { label: 'Finance collection', value: '73.7%', source: '/analytics/finance/overview', insight: 'Outstanding debt is concentrated in Form 3.' },
  { label: 'Attendance', value: '94%', source: '/analytics/attendance/overview', insight: 'Attendance is stable but three students require follow-up.' },
  { label: 'Enrolment', value: '312', source: '/analytics/enrolment', insight: 'Form 1 intake is trending above last year.' },
];

export const timetableEntries = [
  { id: 'tt-1', className: 'Form 3B', teacher: 'Amina Rashidi', subject: 'Chemistry', day: 'Mon', start: '08:00', end: '09:00', room: 'Lab 2' },
  { id: 'tt-2', className: 'Form 4A', teacher: 'Joseph Mrema', subject: 'Physics', day: 'Mon', start: '09:00', end: '10:00', room: 'Lab 1' },
  { id: 'tt-3', className: 'Form 2A', teacher: 'Neema John', subject: 'Biology', day: 'Tue', start: '10:00', end: '11:00', room: 'Lab 3' },
];

export const operationsApi = {
  getReportCatalog: async () => reportCatalog,
  getReportJobs: async () => reportJobs,
  getBulkAssessments: async () => bulkAssessments,
  getBulkMarks: async () => bulkMarks,
  getResultClasses: async () => resultClasses,
  getAnalyticsMetrics: async () => analyticsMetrics,
  getTimetables: async () => timetableEntries,
};
