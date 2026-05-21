import { describe, expect, it } from 'vitest';
import { thresholds } from '../api/aqaApi';
import { hasUnsavedThresholdChanges, heatTone, validateThresholdOrder } from './aqaEngine';

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
