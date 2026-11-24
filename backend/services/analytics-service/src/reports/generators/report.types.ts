export type RowValue = string | number | null | undefined;

/** How a number is shown. `text` is never reformatted (names, grades, registration numbers). */
export type ColumnKind = 'text' | 'int' | 'money' | 'percent' | 'decimal';

/** A key/value line: label, value and, optionally, how to show the value (otherwise guessed from the label). */
export type ReportRow = [label: string, value: RowValue, kind?: ColumnKind];

export type ReportColumn = {
  header: string;
  kind?: ColumnKind;
  /** Relative width; text columns default to 2.2, numeric columns to 1. */
  weight?: number;
};

export type ReportTable = {
  title?: string;
  columns: ReportColumn[];
  rows: RowValue[][];
};

export type ReportSection = {
  heading: string;
  rows: ReportRow[];
  bullets?: string[];
  tables?: ReportTable[];
};
