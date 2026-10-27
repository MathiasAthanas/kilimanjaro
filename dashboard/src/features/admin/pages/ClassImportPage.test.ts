import { describe, expect, it } from 'vitest';
import { normalizeSpreadsheetDate, rowsFromMatrix } from './ClassImportPage';

describe('class import spreadsheet dates', () => {
  it('converts Excel serial values instead of treating them as years', () => {
    expect(normalizeSpreadsheetDate(45000)).toBe('2023-03-15');
    expect(normalizeSpreadsheetDate('45030')).toBe('2023-04-14');
  });

  it('normalizes the date column while preserving other numeric cells as text', () => {
    const parsed = rowsFromMatrix([
      ['Admission Number', 'Name', 'Date of Birth'],
      [30, 'Jonathan Wilson Ngowi', 45000],
    ]);

    expect(parsed.rows).toEqual([{
      admissionNumber: '30',
      name: 'Jonathan Wilson Ngowi',
      dateOfBirth: '2023-03-15',
    }]);
  });
});
