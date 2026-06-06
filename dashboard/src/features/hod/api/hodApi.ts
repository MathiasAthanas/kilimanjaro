import type { HodAlert, HodApproval, HodIntervention, HodMarkRow, HodPairing, HodSubject, HodTeacher } from '../types/hod.types';

export const hodApprovals: HodApproval[] = [
  { id: 'hod-appr-chem-3b-midterm', subject: 'Chemistry', className: 'Form 3B', assessment: 'Chemistry Mid-Term', type: 'Midterm', teacher: 'Amina Rashidi', teacherId: 'teacher-amina', submittedHoursAgo: 53, students: 42, marked: 42, average: 54.1, highest: 94, lowest: 12, status: 'PENDING', riskFlags: ['48h+ overdue', 'Low outlier', 'Chemistry below target'] },
  { id: 'hod-appr-physics-4a-cat', subject: 'Physics', className: 'Form 4A', assessment: 'Physics CAT 2', type: 'CAT', teacher: 'Joseph Mrema', teacherId: 'teacher-joseph', submittedHoursAgo: 26, students: 39, marked: 39, average: 78.2, highest: 96, lowest: 45, status: 'PENDING', riskFlags: ['One high outlier'] },
  { id: 'hod-appr-biology-2a-practical', subject: 'Biology', className: 'Form 2A', assessment: 'Biology Practical', type: 'Practical', teacher: 'Neema John', teacherId: 'teacher-neema', submittedHoursAgo: 14, students: 38, marked: 37, average: 82.4, highest: 98, lowest: 54, status: 'PENDING', riskFlags: ['One absent'] },
];

export const hodSubjects: HodSubject[] = [
  { id: 'biology', name: 'Biology', average: 82, change: 0, atRisk: 8, syllabus: 0, alerts: 2, teacher: 'Neema John', tone: 'emerald', assessments: 2, studentsAssessed: 38, pending: 1, gradeDistribution: { A: 10, B: 14, C: 9, D: 3, E: 2 } },
  { id: 'chemistry', name: 'Chemistry', average: 54, change: 0, atRisk: 24, syllabus: 0, alerts: 12, teacher: 'Amina Rashidi', tone: 'rose', assessments: 3, studentsAssessed: 42, pending: 1, gradeDistribution: { A: 2, B: 6, C: 12, D: 14, E: 8 } },
  { id: 'physics', name: 'Physics', average: 78, change: 0, atRisk: 10, syllabus: 0, alerts: 4, teacher: 'Joseph Mrema', tone: 'blue', assessments: 2, studentsAssessed: 39, pending: 1, gradeDistribution: { A: 8, B: 15, C: 11, D: 4, E: 1 } },
];

export const hodTeachers: HodTeacher[] = [
  { id: 'teacher-amina', name: 'Amina Rashidi', subjects: 'Chemistry - Form 3B, Form 4B', average: 54.1, onTime: 42, syllabus: 45, atRisk: 24, pending: 1, rejections: 2 },
  { id: 'teacher-joseph', name: 'Joseph Mrema', subjects: 'Physics - Form 4A', average: 78.2, onTime: 92, syllabus: 84, atRisk: 10, pending: 1, rejections: 0 },
  { id: 'teacher-neema', name: 'Neema John', subjects: 'Biology - Form 2A', average: 82.4, onTime: 98, syllabus: 90, atRisk: 8, pending: 1, rejections: 0 },
  { id: 'teacher-mambo', name: 'Thomas Mambo', subjects: 'Chemistry - Form 4A', average: 61.6, onTime: 58, syllabus: 62, atRisk: 13, pending: 0, rejections: 1 },
];

export const hodAlerts: HodAlert[] = [
  { id: 'alert-jabir-chem', studentId: 'stu-jabir', student: 'Jabir Hassan', subject: 'Chemistry', className: 'Form 3B', severity: 'CRITICAL', alertType: 'FAILURE_RISK', currentScore: 39, reason: 'Sudden decline from 71% to 39% across two submissions.', action: 'Escalate to Principal' },
  { id: 'alert-amina-bio', studentId: 'stu-amina', student: 'Amina Baraka Juma', subject: 'Biology', className: 'Form 2A', severity: 'MEDIUM', alertType: 'AT_RISK', currentScore: 48, reason: 'Biology practical skills below department median.', action: 'Create Intervention' },
  { id: 'alert-physics-good', studentId: 'stu-zahara', student: 'Zahara Mushi', subject: 'Physics', className: 'Form 4A', severity: 'POSITIVE', alertType: 'CONSISTENT_EXCELLENCE', currentScore: 84, reason: 'Improved by 18% after peer support pairing.', action: 'Record Good News' },
];

export const hodPairings: HodPairing[] = [
  { id: 'pair-chem-1', mentor: 'Joel Komba', support: 'Jabir Hassan', subject: 'Chemistry', className: 'Form 3B', status: 'SUGGESTED', benefit: 'Expected 11% improvement in organic chemistry tasks.', mentorScore: 88, supportScore: 39 },
  { id: 'pair-chem-2', mentor: 'Zahara Mushi', support: 'Amina Baraka Juma', subject: 'Biology', className: 'Form 2A', status: 'SUGGESTED', benefit: 'Practical lab support and weekly check-ins.', mentorScore: 84, supportScore: 48 },
  { id: 'pair-phys-1', mentor: 'Emmanuel John', support: 'Kassim Majaliwa', subject: 'Physics', className: 'Form 4A', status: 'ACTIVE', benefit: 'Current pairing has improved quiz scores.', mentorScore: 91, supportScore: 55 },
];

export const hodInterventions: HodIntervention[] = [
  { id: 'int-chem-jabir', subject: 'Chemistry', className: 'Form 3B', teacher: 'Amina Rashidi', student: 'Jabir Hassan', type: 'Academic Review', note: 'Review lab records and schedule a concept clinic.', status: 'FOLLOW_UP_REQUIRED', age: '2 days ago' },
  { id: 'int-bio-amina', subject: 'Biology', className: 'Form 2A', teacher: 'Neema John', student: 'Amina Baraka Juma', type: 'Practical Support', note: 'Pair during next practical cycle.', status: 'FOLLOW_UP_REQUIRED', age: 'Today' },
  { id: 'int-phys-zahara', subject: 'Physics', className: 'Form 4A', teacher: 'Joseph Mrema', student: 'Zahara Mushi', type: 'Good News', note: 'Intervention completed with measurable improvement.', status: 'COMPLETED', age: 'Last week' },
];

export const hodMarks: HodMarkRow[] = [
  { student: 'Joel Komba', registration: 'KS-2026-00044', score: 94, maxScore: 100, absent: false, note: 'High outlier' },
  { student: 'Zahara Mushi', registration: 'KS-2026-00058', score: 81, maxScore: 100, absent: false, note: 'Valid' },
  { student: 'Sarah Peter', registration: 'KS-2026-00033', score: 57, maxScore: 100, absent: false, note: 'Valid' },
  { student: 'Jabir Hassan', registration: 'KS-2026-00092', score: 12, maxScore: 100, absent: false, note: 'Low outlier' },
  { student: 'Kassim Majaliwa', registration: 'KS-2026-00012', score: null, maxScore: 100, absent: true, note: 'Absent' },
];

export const hodApi = {
  getPendingApprovals: async () => hodApprovals,
  getSubjects: async () => hodSubjects,
  getTeachers: async () => hodTeachers,
  getAlerts: async () => hodAlerts,
  getPairings: async () => hodPairings,
  getInterventions: async () => hodInterventions,
  getMarks: async () => hodMarks,
};
