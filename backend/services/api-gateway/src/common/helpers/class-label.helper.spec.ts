import { formatClassLabel } from './class-label.helper';

describe('formatClassLabel', () => {
  it('does not repeat stored streams', () => {
    expect(formatClassLabel('Class 1 A', 'A')).toBe('Class 1 A');
    expect(formatClassLabel('Class 2 B', 'B')).toBe('Class 2 B');
  });

  it('preserves legacy base names by appending their stream', () => {
    expect(formatClassLabel('Class 1', 'A')).toBe('Class 1 A');
  });
});
