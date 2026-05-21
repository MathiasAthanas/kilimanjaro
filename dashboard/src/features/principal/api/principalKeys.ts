export const principalKeys = {
  all: ['principal'] as const,
  home: () => [...principalKeys.all, 'home'] as const,
  approvals: () => [...principalKeys.all, 'approvals'] as const,
  publishing: () => [...principalKeys.all, 'publishing'] as const,
  finance: () => [...principalKeys.all, 'finance'] as const,
  performance: () => [...principalKeys.all, 'performance'] as const,
  students: () => [...principalKeys.all, 'students'] as const,
  discipline: () => [...principalKeys.all, 'discipline'] as const,
  staff: () => [...principalKeys.all, 'staff'] as const,
  audit: () => [...principalKeys.all, 'audit'] as const,
};
