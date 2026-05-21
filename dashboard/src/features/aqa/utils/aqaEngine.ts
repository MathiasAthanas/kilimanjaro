import type { Threshold } from '../types/aqa.types';

export function validateThresholdOrder(values: Record<string, number>) {
  return values.failure < values.atrisk && values.atrisk < values.excellence;
}

export function hasUnsavedThresholdChanges(original: Threshold[], current: Record<string, number>) {
  return original.some((threshold) => current[threshold.id] !== threshold.value);
}

export function heatTone(average: number) {
  if (average < 60) return 'bg-ks-rose/60 ring-1 ring-ks-rose/50';
  if (average < 70) return 'bg-ks-amber/50';
  if (average < 80) return 'bg-ks-sky/60';
  return 'bg-ks-emerald/80';
}
