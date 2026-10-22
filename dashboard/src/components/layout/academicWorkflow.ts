import type { UserRole } from '../../lib/auth/permissions';

export type WorkflowStep = { label: string; to: string };

const journeys: Partial<Record<UserRole, WorkflowStep[]>> = {
  TEACHER: [
    { label: 'My Classes', to: '/teacher/classes' },
    { label: 'Attendance', to: '/teacher/attendance' },
    { label: 'Assessments & Marks', to: '/teacher/assessments' },
    { label: 'Exam Windows', to: '/teacher/exams' },
    { label: 'Syllabus', to: '/teacher/syllabus' },
    { label: 'Timetable', to: '/teacher/timetable' },
    { label: 'Report Remarks', to: '/teacher/report-remarks' },
    { label: 'E-Learning', to: '/teacher/elearning' },
  ],
  HOD: [
    { label: 'My Classes', to: '/teacher/classes' },
    { label: 'Department', to: '/hod/department' },
    { label: 'Assignments', to: '/hod/assignments' },
    { label: 'Teacher Matrix', to: '/hod/teachers' },
    { label: 'Approvals', to: '/hod/approvals' },
    { label: 'Student Risk', to: '/hod/performance' },
    { label: 'E-Learning', to: '/hod/elearning' },
  ],
  AQA: [
    { label: 'Performance', to: '/aqa/performance' },
    { label: 'At-Risk Students', to: '/aqa/students/at-risk' },
    { label: 'Exam Windows', to: '/exams' },
    { label: 'Exam Types', to: '/exams/types' },
    { label: 'Compose Cards', to: '/exams/compose' },
    { label: 'Engine Control', to: '/aqa/performance/engine' },
    { label: 'Analytics', to: '/aqa/analytics' },
    { label: 'E-Learning Audit', to: '/aqa/elearning' },
  ],
  PRINCIPAL: [
    { label: 'Marks Approval', to: '/principal/approvals' },
    { label: 'Exam Windows', to: '/exams' },
    { label: 'Compose Cards', to: '/exams/compose' },
    { label: 'Publish Results', to: '/principal/results/publish' },
    { label: 'Report Cards', to: '/principal/report-cards' },
    { label: 'E-Learning', to: '/principal/elearning' },
  ],
};

export function getAcademicWorkflow(role: UserRole | undefined): WorkflowStep[] {
  if (role === 'HEAD_OF_SCHOOL') return journeys.PRINCIPAL ?? [];
  return role ? journeys[role] ?? [] : [];
}
