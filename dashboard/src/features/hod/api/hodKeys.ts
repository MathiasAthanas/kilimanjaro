export const hodKeys = {
  all: ['hod'] as const,
  approvals: () => [...hodKeys.all, 'approvals'] as const,
  approval: (id: string) => [...hodKeys.approvals(), id] as const,
  department: () => [...hodKeys.all, 'department'] as const,
  teachers: () => [...hodKeys.all, 'teachers'] as const,
  alerts: () => [...hodKeys.all, 'alerts'] as const,
  pairings: () => [...hodKeys.all, 'pairings'] as const,
  interventions: () => [...hodKeys.all, 'interventions'] as const,
};
