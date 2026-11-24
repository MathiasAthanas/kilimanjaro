import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../csv';
import { formatLabel, withExtension } from './exportReport';

describe('report file names', () => {
  it('always matches the real format, whatever extension the page guessed', () => {
    expect(withExtension('Outstanding_Balances.pdf', 'XLSX')).toBe('Outstanding_Balances.xlsx');
    expect(withExtension('Fee Collection', 'CSV')).toBe('Fee Collection.csv');
    expect(withExtension('report.PDF', 'PDF')).toBe('report.pdf');
  });

  it('calls XLSX Excel for people', () => {
    expect(formatLabel('XLSX')).toBe('Excel');
    expect(formatLabel('PDF')).toBe('PDF');
  });
});

describe('csv export', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Mushi, Rehema')).toBe('"Mushi, Rehema"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('defuses spreadsheet formulas but keeps numbers', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(-12.5)).toBe('-12.5');
  });

  it('writes empty cells for missing values so columns stay aligned', () => {
    expect(toCsv(['A', 'B', 'C'], [['x', null, undefined], [1, 2, 3]])).toBe('A,B,C\r\nx,,\r\n1,2,3');
  });
});
