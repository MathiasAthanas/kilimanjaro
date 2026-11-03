import { formatClassLabel } from './class-label.helper';

describe('formatClassLabel', () => {
  it('does not repeat a stream already present in the class name', () => {
    expect(formatClassLabel('Class 1 A', 'A')).toBe('Class 1 A');
    expect(formatClassLabel('Class 2 B', 'B')).toBe('Class 2 B');
    expect(formatClassLabel('Form 5 CBA', 'CBA')).toBe('Form 5 CBA');
  });

  it('adds a stream when a legacy name does not contain it', () => {
    expect(formatClassLabel('Class 1', 'A')).toBe('Class 1 A');
  });
});
