export const teacherKeys = {
  all: ['teacher'] as const,
  classes: () => [...teacherKeys.all, 'classes'] as const,
  assessments: () => [...teacherKeys.all, 'assessments'] as const,
  students: (classSubjectId: string) => [...teacherKeys.all, 'students', classSubjectId] as const,
  marks: (assessmentId: string) => [...teacherKeys.all, 'marks', assessmentId] as const,
  alerts: () => [...teacherKeys.all, 'alerts'] as const,
  pairings: () => [...teacherKeys.all, 'pairings'] as const,
  timetable: () => [...teacherKeys.all, 'timetable'] as const,
};
