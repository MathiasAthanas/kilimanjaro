import type { LucideIcon } from 'lucide-react';

export type ClassSubject = {
  id: string;
  classId: string;
  className: string;
  subject: string;
  students: number;
  average: number;
  attendance: number;
  syllabus: number;
  openAssessments: number;
  nextLesson: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type Assessment = {
  id: string;
  title: string;
  classSubjectId: string;
  className: string;
  subject: string;
  type: string;
  maxScore: number;
  status: 'DRAFT' | 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'LOCKED' | 'REJECTED';
  entered: number;
  total: number;
  due: string;
  lastSaved: string;
};

export type Student = {
  id: string;
  roll: string;
  name: string;
  registration: string;
  average: number;
  attendance: number;
  alert: 'None' | 'At Risk' | 'Critical' | 'Improving';
  lastAssessment: string;
};

export type MarkRow = Student & {
  score: number | '';
  absent: boolean;
  note: string;
  state: 'saved' | 'dirty' | 'invalid';
};

export type Alert = {
  id: string;
  studentId: string;
  student: string;
  className: string;
  subject: string;
  type: string;
  severity: 'CRITICAL' | 'AT_RISK' | 'INFO';
  reason: string;
  action: string;
};

export type Pairing = {
  id: string;
  mentor: string;
  support: string;
  className: string;
  subject: string;
  reason: string;
  status: 'SUGGESTED' | 'ACTIVE' | 'COMPLETED';
};

export type TimetableEntry = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  room: string;
  current?: boolean;
};

export type TeacherQuickAction = {
  label: string;
  to: string;
  icon: LucideIcon;
};
