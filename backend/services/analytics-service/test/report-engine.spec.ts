import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createReport } from '../src/reports/generators/pdf.helper';
import { formatCell, formatValue, headerLabel, inferKind, toNumber } from '../src/reports/generators/report.format';
import type { ReportSection } from '../src/reports/generators/report.types';
import { REPORT_ACCESS, slug } from '../src/reports/reports.service';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-report-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** pdfkit writes each page object in clear text, so counting them counts the pages. */
const pageCount = (file: string) => (fs.readFileSync(file).toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

const smallSections: ReportSection[] = [
  {
    heading: 'Executive',
    rows: [
      ['Collection Rate', 2.47, 'percent'],
      ['Outstanding Exposure', '340769000', 'money'],
      ['Overdue Amount', 0, 'money'],
      ['Channels', 2, 'int'],
    ],
    bullets: ['Collection is below target.'],
  },
  { heading: 'Billing', rows: [['Total Invoiced', '349400000', 'money']] },
];

describe('report engine: pages', () => {
  it('a short report is one page (the footer must never add blank pages)', async () => {
    const file = path.join(tmp, 'short.pdf');
    await createReport(file, 'Short Report', smallSections);
    expect(pageCount(file)).toBe(1);
  });

  it('page count follows the content, not the footer', async () => {
    const file = path.join(tmp, 'long.pdf');
    const rows = Array.from({ length: 120 }, (_, i) => [`Learner ${i + 1}`, `KEMS-P-${26000 + i}`, 2350000, 0]);
    await createReport(file, 'Outstanding Balances Report', [
      ...smallSections,
      {
        heading: 'Learners With Unpaid Balances',
        rows: [],
        tables: [{ columns: [{ header: 'Learner' }, { header: 'Reg. no.', kind: 'text' }, { header: 'Total', kind: 'money' }, { header: 'Paid', kind: 'money' }], rows }],
      },
    ]);
    const pages = pageCount(file);
    // 120 one-line rows fit roughly 40 to a page: three or four pages, never doubled by footer pages.
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(pages).toBeLessThanOrEqual(5);
  });

  it('a section with no records still prints a message instead of leaving a blank block', async () => {
    const file = path.join(tmp, 'empty.pdf');
    await createReport(file, 'Empty', [{ heading: 'Executive', rows: [['Total', 0, 'int']] }, { heading: 'Nothing here', rows: [] }]);
    expect(pageCount(file)).toBe(1);
    expect(fs.statSync(file).size).toBeGreaterThan(1000);
  });
});

describe('report engine: spreadsheet exports', () => {
  const sections: ReportSection[] = [
    ...smallSections,
    {
      heading: 'Collections',
      rows: [],
      tables: [
        {
          title: 'By fee category',
          columns: [{ header: 'Fee category' }, { header: 'Billed', kind: 'money' }, { header: 'Collected %', kind: 'percent' }],
          rows: [['Tuition Fee', 243900000.4, 2.5812345], ['=SUM(A1)', 100, 1]],
        },
        { title: 'Nothing', columns: [{ header: 'A' }], rows: [] },
      ],
    },
  ];

  it('writes numbers as numbers, one sheet per filled table, and no empty sheets', async () => {
    const file = path.join(tmp, 'report.xlsx');
    await createReport(file, 'Finance', sections);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Summary', 'By fee category', 'Notes']);

    const summary = workbook.getWorksheet('Summary')!;
    expect(summary.getRow(1).values).toEqual([undefined, 'Section', 'Metric', 'Value']);
    expect(summary.getRow(3).getCell(3).value).toBe(340769000);

    const table = workbook.getWorksheet('By fee category')!;
    expect(table.getRow(1).getCell(2).value).toBe('Billed (TZS)');
    expect(table.getRow(2).getCell(2).value).toBe(243900000); // whole shillings
    expect(table.getRow(2).getCell(3).value).toBe(2.58); // two decimals
  });

  it('writes a CSV with a BOM and no live formulas', async () => {
    const file = path.join(tmp, 'report.csv');
    await createReport(file, 'Finance', sections);
    const text = fs.readFileSync(file, 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Fee category,Billed (TZS),Collected %');
    expect(text).toContain("'=SUM(A1)");
    expect(text).not.toContain('Nothing');
  });
});

describe('report engine: formatting', () => {
  it('shows a whole amount, never a cut-off one', () => {
    expect(formatValue('Outstanding Exposure', '340769000')).toBe('TZS 340,769,000');
    expect(formatValue('Total Invoiced', '349400000')).toBe('TZS 349,400,000');
  });

  it('keeps counts as counts', () => {
    expect(inferKind('Classes Below 80%')).toBe('int');
    expect(inferKind('Overdue Invoices')).toBe('int');
    expect(inferKind('Collection Rate')).toBe('percent');
    expect(formatValue('Students Below 80%', 31)).toBe('31');
  });

  it('never reformats text and shows missing values as a dash', () => {
    expect(formatValue('Registration Number', '2026', 'text')).toBe('2026');
    expect(formatValue('Teacher', null)).toBe('-');
    expect(formatCell(undefined, 'money')).toBe('-');
    expect(formatCell(5, 'text')).toBe('5');
  });

  it('table amounts are plain numbers under a currency heading', () => {
    expect(formatCell(2350000, 'money')).toBe('2,350,000');
    expect(headerLabel({ header: 'Balance', kind: 'money' })).toBe('Balance (TZS)');
    expect(headerLabel({ header: 'Balance (TZS)', kind: 'money' })).toBe('Balance (TZS)');
  });

  it('reads Decimal strings and refuses non-numbers', () => {
    expect(toNumber('1,234.5')).toBe(1234.5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('')).toBeNull();
  });

  it('builds a download name from the report title', () => {
    expect(slug('Outstanding Balances Report')).toBe('Outstanding_Balances_Report');
  });
});

describe('report access', () => {
  it('keeps finance reports with the finance team and academic reports with teaching staff', () => {
    expect(REPORT_ACCESS.FINANCE_COLLECTION).toContain('FINANCE');
    expect(REPORT_ACCESS.FINANCE_COLLECTION).not.toContain('TEACHER');
    expect(REPORT_ACCESS.OUTSTANDING_BALANCES).not.toContain('HEAD_OF_DEPARTMENT');
    expect(REPORT_ACCESS.SCHOOL_OVERVIEW).not.toContain('TEACHER');
    expect(REPORT_ACCESS.BOARD_EXECUTIVE).not.toContain('FINANCE');
    expect(REPORT_ACCESS.ATTENDANCE_SUMMARY).toContain('TEACHER');
    expect(REPORT_ACCESS.PERFORMANCE_ENGINE).toContain('ACADEMIC_QA');
  });
});
