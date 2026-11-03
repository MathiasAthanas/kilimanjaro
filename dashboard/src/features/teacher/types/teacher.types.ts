import type { LucideIcon } from 'lucide-react';

export type ClassSubject = {
  /** class-subject id (what every teacher URL uses) */
  id: string;
  classId: string;
  schoolId: string;
  subjectId: string;
  /** "Form 6 HGL" / "Standard 4 A" */
  className: string;
  subject: string;
  stage: string;
  isOptional: boolean;
  combination: string;
  /** students who actually take this subject */
  students: number;
  classSize: number;
  average: number;
  attendance: number;
  syllabus: number;
  syllabusTotal: number;
  syllabusCovered: number;
  syllabusTermId: string;
  syllabusNotes: string;
  assessmentCount: number;
  openAssessments: number;
  isClassTeacher: boolean;
  periodsPerWeek: number;
  nextLesson: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type Assessment = {
  id: string;
  title: string;
  classSubjectId: string;
  classId: string;
  schoolId: string;
  className: string;
  subject: string;
  type: string;
  maxScore: number;
  status: 'DRAFT' | 'OPEN' | 'SUBMITTED' | 'HOD_APPROVED' | 'APPROVED' | 'LOCKED' | 'REJECTED';
  entered: number;
  total: number;
  due: string;
  lastSaved: string;
  rejectionReason: string;
  /** set when the assessment belongs to an exam window (marks go through the exam marks screen) */
  examWindow: { id: string; name: string; status: string; closesAt: string | null } | null;
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
  /** today's register status, when one was already taken */
  todayStatus?: string | null;
};

export type MarkRow = Student & {
  score: number | '';
  absent: boolean;
  /** required to sit but did not: scores 0 and counts in the average */
  notSat: boolean;
  /** approved exemption: no mark needed */
  exempt: boolean;
  /** a mark for this student is already stored */
  saved: boolean;
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
  status?: string;
  classId?: string;
  schoolId?: string;
};

export type Pairing = {
  id: string;
  mentor: string;
  support: string;
  className: string;
  subject: string;
  reason: string;
  status: 'SUGGESTED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';
  mentorScore?: number | null;
  supportScore?: number | null;
  classId?: string;
  schoolId?: string;
};

export type TimetableEntry = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  room: string;
  schoolId?: string;
  current?: boolean;
};

export type TeacherRegister = {
  classId: string;
  schoolId: string;
  label: string;
  stage: string;
  studentCount: number;
  isClassTeacher: boolean;
};

export type TeacherQuickAction = {
  label: string;
  to: string;
  icon: LucideIcon;
};
