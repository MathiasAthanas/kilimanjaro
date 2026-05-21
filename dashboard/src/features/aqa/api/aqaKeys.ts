export const aqaKeys = {
  all: ['aqa'] as const,
  alerts: () => [...aqaKeys.all, 'alerts'] as const,
  engine: () => [...aqaKeys.all, 'engine'] as const,
  config: () => [...aqaKeys.engine(), 'config'] as const,
  heatmap: () => [...aqaKeys.all, 'heatmap'] as const,
  pairings: () => [...aqaKeys.all, 'pairings'] as const,
  interventions: () => [...aqaKeys.all, 'interventions'] as const,
  reports: () => [...aqaKeys.all, 'reports'] as const,
};
