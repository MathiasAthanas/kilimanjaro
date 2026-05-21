import { BookOpen, CalendarCheck, Edit3 } from 'lucide-react';
import type { Alert, Assessment, ClassSubject, MarkRow, Pairing, Student, TeacherQuickAction, TimetableEntry } from '../types/teacher.types';

export const teacherClasses: ClassSubject[] = [
  { id: 'cs-form3a-math', classId: 'class-form3a', className: 'Form 3A', subject: 'Mathematics', students: 42, average: 76, attendance: 94, syllabus: 71, openAssessments: 2, nextLesson: 'Today 10:20', risk: 'MEDIUM' },
  { id: 'cs-form2a-physics', classId: 'class-form2a', className: 'Form 2A', subject: 'Physics', students: 38, average: 81, attendance: 96, syllabus: 84, openAssessments: 1, nextLesson: 'Today 12:10', risk: 'LOW' },
  { id: 'cs-form3b-math', classId: 'class-form3b', className: 'Form 3B', subject: 'Mathematics', students: 40, average: 69, attendance: 89, syllabus: 62, openAssessments: 3, nextLesson: 'Tomorrow 08:00', risk: 'HIGH' },
];

export const assessments: Assessment[] = [
  { id: 'assess-midterm-math-3a', title: 'Midterm Mathematics', classSubjectId: 'cs-form3a-math', className: 'Form 3A', subject: 'Mathematics', type: 'Midterm', maxScore: 100, status: 'OPEN', entered: 36, total: 42, due: 'May 24', lastSaved: '8 mins ago' },
  { id: 'assess-cat-physics-2a', title: 'CAT 2 Physics', classSubjectId: 'cs-form2a-physics', className: 'Form 2A', subject: 'Physics', type: 'CAT 2', maxScore: 30, status: 'SUBMITTED', entered: 38, total: 38, due: 'Submitted', lastSaved: 'Yesterday' },
  { id: 'assess-final-math-3b', title: 'Final Mathematics', classSubjectId: 'cs-form3b-math', className: 'Form 3B', subject: 'Mathematics', type: 'Final', maxScore: 100, status: 'DRAFT', entered: 12, total: 40, due: 'May 28', lastSaved: 'Draft' },
];

export const students: Student[] = [
  { id: 'stu-amina', roll: '01', name: 'Amina Baraka Juma', registration: 'KS-2026-00001', average: 88, attendance: 96, alert: 'Improving', lastAssessment: '92' },
  { id: 'stu-kassim', roll: '02', name: 'Kassim Majaliwa', registration: 'KS-2026-00012', average: 49, attendance: 78, alert: 'Critical', lastAssessment: '38' },
  { id: 'stu-sarah', roll: '03', name: 'Sarah Peter', registration: 'KS-2026-00033', average: 61, attendance: 91, alert: 'At Risk', lastAssessment: '57' },
  { id: 'stu-joel', roll: '04', name: 'Joel Komba', registration: 'KS-2026-00044', average: 94, attendance: 98, alert: 'None', lastAssessment: '96' },
  { id: 'stu-zahara', roll: '05', name: 'Zahara Mushi', registration: 'KS-2026-00058', average: 84, attendance: 93, alert: 'None', lastAssessment: '86' },
  { id: 'stu-emmanuel', roll: '06', name: 'Emmanuel John', registration: 'KS-2026-00061', average: 55, attendance: 84, alert: 'At Risk', lastAssessment: '51' },
  { id: 'stu-neema', roll: '07', name: 'Neema Paul', registration: 'KS-2026-00070', average: 73, attendance: 95, alert: 'None', lastAssessment: '74' },
  { id: 'stu-juma', roll: '08', name: 'Juma Ally', registration: 'KS-2026-00076', average: 67, attendance: 88, alert: 'Improving', lastAssessment: '70' },
];

export const marksRows: MarkRow[] = students.map((student, index) => ({
  ...student,
  score: index === 1 ? 38 : index === 2 ? '' : Number(student.lastAssessment),
  absent: false,
  note: index === 1 ? 'Needs review' : '',
  state: index === 2 ? 'dirty' : 'saved',
}));

export const alerts: Alert[] = [
  { id: 'alert-kassim', studentId: 'stu-kassim', student: 'Kassim Majaliwa', className: 'Form 4A', subject: 'Advanced Physics', type: 'Critical Drop', severity: 'CRITICAL', reason: 'Score fell by 19 points across two assessments.', action: 'Schedule Review' },
  { id: 'alert-sarah', studentId: 'stu-sarah', student: 'Sarah Peter', className: 'Form 3A', subject: 'Mathematics', type: 'Attendance Gap', severity: 'AT_RISK', reason: 'Attendance below 85% with weak algebra performance.', action: 'Call Parent' },
  { id: 'alert-emmanuel', studentId: 'stu-emmanuel', student: 'Emmanuel John', className: 'Form 2A', subject: 'Physics', type: 'Concept Struggle', severity: 'INFO', reason: 'Lab report marks remain below class median.', action: 'Assign Peer' },
];

export const pairings: Pairing[] = [
  { id: 'pair-joel-sarah', mentor: 'Joel Komba', support: 'Sarah Peter', className: 'Form 3A', subject: 'Mathematics', reason: 'Joel excels in calculus; Sarah needs support in integral functions.', status: 'SUGGESTED' },
  { id: 'pair-zahara-emmanuel', mentor: 'Zahara Mushi', support: 'Emmanuel John', className: 'Form 2A', subject: 'Physics', reason: 'Zahara demonstrates lab mastery; Emmanuel needs report assistance.', status: 'SUGGESTED' },
];

export const timetable: TimetableEntry[] = [
  { id: 'tt-1', day: 'Mon', time: '08:00', className: 'Form 3A', subject: 'Mathematics', room: 'Block A-2' },
  { id: 'tt-2', day: 'Mon', time: '10:20', className: 'Form 2A', subject: 'Physics', room: 'Lab 1', current: true },
  { id: 'tt-3', day: 'Tue', time: '09:10', className: 'Form 3B', subject: 'Mathematics', room: 'Block B-1' },
  { id: 'tt-4', day: 'Wed', time: '12:10', className: 'Form 3A', subject: 'Mathematics', room: 'Block A-2' },
  { id: 'tt-5', day: 'Thu', time: '08:00', className: 'Form 2A', subject: 'Physics', room: 'Lab 1' },
];

export const quickActions: TeacherQuickAction[] = [
  { label: 'Mark Attendance', to: '/teacher/attendance', icon: CalendarCheck },
  { label: 'Enter Marks', to: '/teacher/assessments/assess-midterm-math-3a/marks', icon: Edit3 },
  { label: 'Open Classes', to: '/teacher/classes', icon: BookOpen },
];

export const teacherApi = {
  getClasses: async () => teacherClasses,
  getAssessments: async () => assessments,
  getStudents: async () => students,
  getMarks: async () => marksRows,
  getAlerts: async () => alerts,
  getPairings: async () => pairings,
  getTimetable: async () => timetable,
};
