import { describe, expect, it } from 'vitest';
import type { Threshold } from '../types/aqa.types';
import { hasUnsavedThresholdChanges, heatTone, validateThresholdOrder } from './aqaEngine';

const thresholds: Threshold[] = [
  { id: 'failure', label: 'Failure', value: 35, min: 0, max: 100, tone: 'rose', description: '' },
  { id: 'atrisk', label: 'At risk', value: 48, min: 0, max: 100, tone: 'amber', description: '' },
  { id: 'excellence', label: 'Excellence', value: 85, min: 0, max: 100, tone: 'emerald', description: '' },
  { id: 'decline', label: 'Decline', value: 15, min: 0, max: 100, tone: 'blue', description: '' },
];

describe('aqa engine utilities', () => {
  it('validates threshold ordering', () => {
    expect(validateThresholdOrder({ failure: 35, atrisk: 48, excellence: 85 })).toBe(true);
    expect(validateThresholdOrder({ failure: 55, atrisk: 48, excellence: 85 })).toBe(false);
  });

  it('detects unsaved threshold changes', () => {
    expect(hasUnsavedThresholdChanges(thresholds, { failure: 35, atrisk: 48, excellence: 85, decline: 15 })).toBe(false);
    expect(hasUnsavedThresholdChanges(thresholds, { failure: 34, atrisk: 48, excellence: 85, decline: 15 })).toBe(true);
  });

  it('marks weak heatmap cells with rose treatment', () => {
    expect(heatTone(54)).toContain('ks-rose');
  });
});
