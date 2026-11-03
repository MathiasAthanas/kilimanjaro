import { describe, expect, it } from 'vitest';
import { formatClassLabel } from './classLabel';

describe('formatClassLabel', () => {
  it('does not repeat a stream already in a spaced class name', () => {
    expect(formatClassLabel('Class 1 A', 'A')).toBe('Class 1 A');
    expect(formatClassLabel('Class 2 B', 'B')).toBe('Class 2 B');
    expect(formatClassLabel('Form 5 CBA', 'CBA')).toBe('Form 5 CBA');
  });

  it('does not repeat a stream in compact legacy class names', () => {
    expect(formatClassLabel('Class 1A', 'A')).toBe('Class 1A');
  });

  it('adds a missing stream and supports presentation separators', () => {
    expect(formatClassLabel('Class 1', 'A')).toBe('Class 1 A');
    expect(formatClassLabel('Class 1', 'A', ' · ')).toBe('Class 1 · A');
  });

  it('normalizes empty and repeated whitespace safely', () => {
    expect(formatClassLabel('  Class   1 A  ', ' A ')).toBe('Class 1 A');
    expect(formatClassLabel('Class 1', null)).toBe('Class 1');
  });
});
