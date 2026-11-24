import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import type { ColumnKind, ReportSection, ReportTable, RowValue } from './report.types';
import { headerLabel, inferKind, toNumber } from './report.format';

const NUMBER_FORMAT: Record<ColumnKind, string | undefined> = {
  text: undefined,
  int: '#,##0',
  money: '#,##0',
  percent: '0.00"%"',
  decimal: '#,##0.00',
};

/** Excel sheet names: at most 31 characters, none of []:*?/\ and unique within the workbook. */
function sheetName(raw: string, used: Set<string>): string {
  const base = (raw.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sheet').slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` ${n++}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

function cellValue(value: RowValue, kind: ColumnKind): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (kind === 'text') return String(value).replaceAll('_', ' ');
  const n = toNumber(value);
  if (n === null) return String(value).replaceAll('_', ' ');
  // Whole shillings, two decimals for rates: the stored figures carry long floating-point tails.
  if (kind === 'money') return Math.round(n);
  if (kind === 'percent' || kind === 'decimal') return Math.round(n * 100) / 100;
  return n;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF061F33' } };
  row.alignment = { vertical: 'middle' };
  row.height = 20;
}

function fitColumns(sheet: ExcelJS.Worksheet, min = 10, max = 60) {
  sheet.columns.forEach((column) => {
    let widest = min;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const text = cell.value === null || cell.value === undefined ? '' : String(typeof cell.value === 'object' ? (cell.value as any).text ?? '' : cell.value);
      widest = Math.max(widest, Math.min(max, text.length + 2));
    });
    column.width = widest;
  });
}

function addTableSheet(workbook: ExcelJS.Workbook, name: string, table: ReportTable) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(table.columns.map(headerLabel));
  styleHeader(sheet.getRow(1));
  for (const row of table.rows) {
    sheet.addRow(table.columns.map((c, i) => cellValue(row[i], c.kind ?? 'text')));
  }
  table.columns.forEach((c, i) => {
    const fmt = NUMBER_FORMAT[c.kind ?? 'text'];
    if (fmt) sheet.getColumn(i + 1).numFmt = fmt;
    if (c.kind && c.kind !== 'text') sheet.getColumn(i + 1).alignment = { horizontal: 'right' };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (table.rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.columns.length } };
  fitColumns(sheet);
}

export async function writeXlsx(filePath: string, title: string, sections: ReportSection[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kilimanjaro Schools';
  workbook.title = title;
  workbook.created = new Date();
  const used = new Set<string>();

  // One summary sheet with every key figure, so the numbers are filterable and sortable.
  const summary = workbook.addWorksheet(sheetName('Summary', used));
  summary.addRow(['Section', 'Metric', 'Value']);
  styleHeader(summary.getRow(1));
  for (const section of sections) {
    for (const [label, value, kind] of section.rows) {
      const resolved = kind ?? inferKind(label);
      const row = summary.addRow([section.heading, label, cellValue(value, resolved)]);
      const fmt = NUMBER_FORMAT[resolved];
      const cell = row.getCell(3);
      if (fmt && typeof cell.value === 'number') cell.numFmt = fmt;
      cell.alignment = { horizontal: 'right' };
    }
  }
  summary.views = [{ state: 'frozen', ySplit: 1 }];
  fitColumns(summary);

  // Every table becomes its own sheet with typed number columns.
  for (const section of sections) {
    for (const table of section.tables ?? []) {
      if (!table.rows.length) continue; // an empty sheet is just noise
      addTableSheet(workbook, sheetName(table.title ?? section.heading, used), table);
    }
  }

  const notes = sections.flatMap((s) => (s.bullets ?? []).map((b) => [s.heading, b]));
  if (notes.length) {
    const sheet = workbook.addWorksheet(sheetName('Notes', used));
    sheet.addRow(['Section', 'Note']);
    styleHeader(sheet.getRow(1));
    notes.forEach((n) => sheet.addRow(n));
    sheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    fitColumns(sheet);
    sheet.getColumn(2).width = 110;
  }

  await workbook.xlsx.writeFile(filePath);
}

/** Quotes a cell and defuses spreadsheet formulas in text that may have been typed by users. */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function writeCsv(filePath: string, title: string, sections: ReportSection[]) {
  const lines: string[] = [];
  const add = (...cells: unknown[]) => lines.push(cells.map(csvCell).join(','));
  add('Report', title);
  add('Generated', new Date().toISOString());
  for (const section of sections) {
    lines.push('');
    add(section.heading);
    if (section.rows.length) {
      add('Metric', 'Value');
      for (const [label, value, kind] of section.rows) add(label, cellValue(value, kind ?? inferKind(label)));
    }
    for (const table of section.tables ?? []) {
      if (!table.rows.length) continue;
      lines.push('');
      if (table.title) add(table.title);
      add(...table.columns.map(headerLabel));
      for (const row of table.rows) add(...table.columns.map((c, i) => cellValue(row[i], c.kind ?? 'text')));
    }
    if (section.bullets?.length) {
      lines.push('');
      add('Notes');
      section.bullets.forEach((b) => add(b));
    }
  }
  // BOM so Excel opens UTF-8 names correctly.
  await fs.promises.writeFile(filePath, `﻿${lines.join('\r\n')}\r\n`, 'utf8');
}
