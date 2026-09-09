import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ExamResultsService } from './exam-results.service';
import { GradingResolverService } from './grading-resolver.service';

// esModuleInterop is off in this service — use the require form for a usable constructor.
import PDFDocument = require('pdfkit');

interface MeritFilter {
  classId?: string;
  level?: number;
}

interface SubjectCell {
  subjectId: string;
  subjectName: string;
  code: string;
  score: number;
  grade: string;
  isAbsent: boolean;
  missing: boolean;
}

@Injectable()
export class MeritExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examResults: ExamResultsService,
    private readonly grading: GradingResolverService,
  ) {}

  private fmtDev(row: any): string {
    const v = row.prevWindowDelta ?? row.classMeanDev ?? 0;
    const n = Math.round(v * 10) / 10;
    return `${n > 0 ? '+' : ''}${n}`;
  }

  private cellText(cell: SubjectCell | undefined): string {
    if (!cell || cell.missing) return '';
    if (cell.isAbsent) return 'ABS';
    return `${Math.round(cell.score)} ${cell.grade}`;
  }

  /** Load merit data + a mean→grade resolver for the summary rows. */
  private async gather(windowId: string, user: RequestUser, filter?: MeritFilter) {
    const merit = await this.examResults.getMeritList(windowId, user, filter);
    const window = await this.prisma.examWindow.findUnique({
      where: { id: windowId },
      include: { examType: true },
    });

    // Representative stage/level for the summary "Grade" column.
    const rows = merit.rows as any[];
    const stage = (rows[0]?.educationStage as string | null) ?? window?.educationStage ?? null;
    const level = (rows[0]?.classLevel as number | null) ?? null;
    let gradeOf: (mean: number) => string = () => '';
    try {
      if (window) {
        const scale = await this.grading.getActiveScale(
          window.academicYearId,
          { educationStage: stage, classLevel: level, subjectId: null },
          window.schoolId ?? null,
        );
        gradeOf = (mean: number) => this.grading.resolveGrade(scale, mean).grade;
      }
    } catch {
      /* no scale — leave grade blank */
    }

    return { merit, window, gradeOf };
  }

  private title(window: any): string {
    const type = window?.examType?.name ? ` — ${window.examType.name}` : '';
    return `${window?.name ?? 'Exam Window'}${type}`;
  }

  // ─── Excel (exact two-sheet layout) ───────────────────────────────────────

  async buildWorkbook(windowId: string, user: RequestUser, filter?: MeritFilter): Promise<{ filename: string; buffer: Buffer }> {
    const { merit, window, gradeOf } = await this.gather(windowId, user, filter);
    const subjects = merit.subjects as Array<{ subjectId: string; subjectName: string; code: string }>;
    const rows = merit.rows as any[];
    const gradeCodes = (merit.gradeCodes as string[]) ?? ['A', 'B', 'C', 'D', 'E', 'X'];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kilimanjaro School System';
    wb.created = new Date();

    // ── Sheet 1: Merit List ──
    const ws = wb.addWorksheet('Merit List', { views: [{ state: 'frozen', ySplit: 3, xSplit: 2 }] });
    const headers = ['ADMNO', 'NAME', 'STR', ...subjects.map((s) => s.code || s.subjectName.slice(0, 4).toUpperCase()), 'SBJ', 'TT MKS', 'MN MKS', 'DEV', 'GR', 'STR POS', 'OVR POS'];
    const lastCol = headers.length;

    // Title row (merged).
    ws.mergeCells(1, 1, 1, lastCol);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = this.title(window);
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Subtitle row (merged).
    ws.mergeCells(2, 1, 2, lastCol);
    const sub = ws.getCell(2, 1);
    sub.value = `${rows.length} candidates · generated ${new Date().toISOString().slice(0, 10)}`;
    sub.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
    sub.alignment = { horizontal: 'center' };

    // Header row (row 3).
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3B73' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { bottom: { style: 'thin' }, right: { style: 'hair' } };
    });
    headerRow.height = 20;

    // Data rows.
    rows.forEach((r, idx) => {
      const scores = (r.subjectScores ?? {}) as Record<string, SubjectCell>;
      const rowVals: (string | number)[] = [
        r.registrationNumber ?? '',
        r.studentName ?? '',
        r.stream ?? '',
        ...subjects.map((s) => this.cellText(scores[s.subjectId])),
        r.subjectCount ?? 0,
        r.total ?? 0,
        r.mean ?? 0,
        this.fmtDev(r),
        r.overallGrade ?? '',
        r.streamRank ?? '',
        r.standardRank ?? '',
      ];
      const row = ws.getRow(4 + idx);
      rowVals.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v as any;
        c.alignment = { horizontal: i === 1 ? 'left' : 'center' };
        c.border = { bottom: { style: 'hair' }, right: { style: 'hair' } };
        if (i >= 3 && i < 3 + subjects.length) c.font = { size: 10 };
      });
    });

    // Column widths.
    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 26;
    ws.getColumn(3).width = 6;
    for (let i = 0; i < subjects.length; i++) ws.getColumn(4 + i).width = 9;
    const tail = 4 + subjects.length;
    [tail, tail + 1, tail + 2, tail + 3, tail + 4, tail + 5, tail + 6].forEach((ci, k) => {
      ws.getColumn(ci).width = [6, 8, 8, 8, 5, 8, 8][k];
    });

    // ── Sheet 2: Grade Summaries ──
    const gs = wb.addWorksheet('Grade Summaries');
    let r = 1;
    const writeSection = (
      title: string,
      firstColHeader: string,
      records: Array<{ label: string; entries: number; meanMarks: number; distribution: Record<string, number> }>,
    ) => {
      gs.mergeCells(r, 1, r, 4 + gradeCodes.length);
      const t = gs.getCell(r, 1);
      t.value = title;
      t.font = { bold: true, size: 12 };
      r += 1;

      const head = [firstColHeader, ...gradeCodes, 'Entries', 'Mean Marks', 'Grade'];
      const hr = gs.getRow(r);
      head.forEach((h, i) => {
        const c = hr.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3B73' } };
        c.alignment = { horizontal: 'center' };
      });
      r += 1;

      for (const rec of records) {
        const vals: (string | number)[] = [
          rec.label,
          ...gradeCodes.map((g) => rec.distribution[g] ?? 0),
          rec.entries,
          rec.meanMarks,
          gradeOf(rec.meanMarks),
        ];
        const dr = gs.getRow(r);
        vals.forEach((v, i) => {
          const c = dr.getCell(i + 1);
          c.value = v as any;
          c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
        });
        r += 1;
      }
      r += 2; // spacer
    };

    const byStream = (merit.summaries.byStream as any[]).map((s) => ({
      label: `${s.className ?? ''}${s.stream ? ' ' + s.stream : ''}`.trim() || s.classId,
      entries: s.entries,
      meanMarks: s.meanMarks,
      distribution: s.distribution,
    }));
    writeSection('Grade Breakdown (by stream)', 'Class', byStream);

    const bySubject = (merit.summaries.bySubject as any[]).map((s) => ({
      label: s.subjectName,
      entries: s.entries,
      meanMarks: s.meanMarks,
      distribution: s.distribution,
    }));
    writeSection('Class Grade Summary (by subject)', 'Subject', bySubject);

    const byGender = (merit.summaries.byGender as any[]).map((s) => ({
      label: s.gender,
      entries: s.entries,
      meanMarks: s.meanMarks,
      distribution: s.distribution,
    }));
    writeSection('Gender Summary', 'Gender', byGender);

    gs.getColumn(1).width = 24;
    for (let i = 0; i < gradeCodes.length; i++) gs.getColumn(2 + i).width = 5;
    gs.getColumn(2 + gradeCodes.length).width = 9;
    gs.getColumn(3 + gradeCodes.length).width = 11;
    gs.getColumn(4 + gradeCodes.length).width = 7;

    const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    return { filename: this.safeName(window) + '.xlsx', buffer };
  }

  private safeName(window: any): string {
    return `merit-list-${String(window?.name ?? 'window').replace(/[^a-z0-9]+/gi, '-')}`.replace(/-+$/,'');
  }

  // ─── CSV (merit sheet only) ────────────────────────────────────────────────

  async buildCsv(windowId: string, user: RequestUser, filter?: MeritFilter): Promise<{ filename: string; csv: string }> {
    const { merit, window } = await this.gather(windowId, user, filter);
    const subjects = merit.subjects as Array<{ subjectId: string; subjectName: string; code: string }>;
    const rows = merit.rows as any[];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['ADMNO', 'NAME', 'STR', ...subjects.map((s) => s.code || s.subjectName), 'SBJ', 'TT MKS', 'MN MKS', 'DEV', 'GR', 'STR POS', 'OVR POS'];
    const lines = [`# ${this.title(window)}`, header.map(esc).join(',')];
    for (const r of rows) {
      const scores = (r.subjectScores ?? {}) as Record<string, SubjectCell>;
      lines.push([
        esc(r.registrationNumber), esc(r.studentName), esc(r.stream),
        ...subjects.map((s) => esc(this.cellText(scores[s.subjectId]))),
        esc(r.subjectCount), esc(r.total), esc(r.mean), esc(this.fmtDev(r)), esc(r.overallGrade), esc(r.streamRank), esc(r.standardRank),
      ].join(','));
    }
    return { filename: this.safeName(window) + '.csv', csv: '﻿' + lines.join('\r\n') + '\r\n' };
  }

  // ─── PDF (landscape print) ─────────────────────────────────────────────────

  async buildPdf(windowId: string, user: RequestUser, filter?: MeritFilter): Promise<{ filename: string; buffer: Buffer }> {
    const { merit, window, gradeOf } = await this.gather(windowId, user, filter);
    const subjects = merit.subjects as Array<{ subjectId: string; subjectName: string; code: string }>;
    const rows = merit.rows as any[];
    const gradeCodes = (merit.gradeCodes as string[]) ?? [];

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve({ filename: this.safeName(window) + '.pdf', buffer: Buffer.concat(chunks) }));

        const pageLeft = doc.page.margins.left;
        const pageRight = doc.page.width - doc.page.margins.right;
        const usable = pageRight - pageLeft;

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#1F3B73').text(this.title(window), { align: 'center' });
        doc.font('Helvetica').fontSize(8).fillColor('#666').text(`${rows.length} candidates · generated ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
        doc.moveDown(0.5);

        // Column layout: fixed left/right, subjects share the middle.
        const fixedLeft = [ { k: 'admno', w: 52 }, { k: 'name', w: 118 }, { k: 'str', w: 20 } ];
        const fixedRight = [ { k: 'sbj', w: 22 }, { k: 'tot', w: 34 }, { k: 'mean', w: 34 }, { k: 'dev', w: 30 }, { k: 'gr', w: 20 }, { k: 'spos', w: 26 }, { k: 'opos', w: 26 } ];
        const fixedWidth = [...fixedLeft, ...fixedRight].reduce((s, c) => s + c.w, 0);
        const subjW = Math.max(20, Math.min(46, (usable - fixedWidth) / Math.max(subjects.length, 1)));
        const smallFont = subjects.length > 9 ? 6 : 7;

        const cols: Array<{ label: string; w: number; align?: string }> = [
          { label: 'ADMNO', w: fixedLeft[0].w },
          { label: 'NAME', w: fixedLeft[1].w, align: 'left' },
          { label: 'STR', w: fixedLeft[2].w },
          ...subjects.map((s) => ({ label: s.code || s.subjectName.slice(0, 4).toUpperCase(), w: subjW })),
          { label: 'SBJ', w: fixedRight[0].w },
          { label: 'TOT', w: fixedRight[1].w },
          { label: 'MN', w: fixedRight[2].w },
          { label: 'DEV', w: fixedRight[3].w },
          { label: 'GR', w: fixedRight[4].w },
          { label: 'STR', w: fixedRight[5].w },
          { label: 'OVR', w: fixedRight[6].w },
        ];

        const rowH = 14;
        let y = doc.y;
        const drawRow = (values: string[], opts: { header?: boolean } = {}) => {
          if (y + rowH > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            y = doc.page.margins.top;
          }
          let x = pageLeft;
          if (opts.header) {
            doc.rect(pageLeft, y, usable, rowH).fill('#1F3B73');
          }
          doc.font(opts.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.header ? 7 : smallFont)
            .fillColor(opts.header ? '#FFFFFF' : '#111');
          cols.forEach((c, i) => {
            const txt = values[i] ?? '';
            doc.text(txt, x + 1, y + 3, { width: c.w - 2, align: (c.align as any) || 'center', lineBreak: false, ellipsis: true });
            x += c.w;
          });
          if (!opts.header) {
            doc.strokeColor('#DDD').lineWidth(0.3).moveTo(pageLeft, y + rowH).lineTo(pageLeft + usable, y + rowH).stroke();
          }
          y += rowH;
        };

        drawRow(cols.map((c) => c.label), { header: true });
        for (const r of rows) {
          const scores = (r.subjectScores ?? {}) as Record<string, SubjectCell>;
          drawRow([
            r.registrationNumber ?? '', r.studentName ?? '', r.stream ?? '',
            ...subjects.map((s) => this.cellText(scores[s.subjectId])),
            String(r.subjectCount ?? ''), String(r.total ?? ''), String(r.mean ?? ''), this.fmtDev(r), r.overallGrade ?? '', String(r.streamRank ?? ''), String(r.standardRank ?? ''),
          ]);
        }

        // Grade summaries page.
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#1F3B73').text('Grade Summaries', { align: 'center' });
        doc.moveDown(0.5);
        const section = (heading: string, firstHeader: string, recs: Array<{ label: string; entries: number; meanMarks: number; distribution: Record<string, number> }>) => {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(heading);
          doc.moveDown(0.2);
          const gc = gradeCodes.length ? gradeCodes : Object.keys(recs[0]?.distribution ?? {});
          const heads = [firstHeader, ...gc, 'Entries', 'Mean', 'Grade'];
          const colW = [140, ...gc.map(() => 26), 46, 46, 34];
          let yy = doc.y;
          const totalW = colW.reduce((a, b) => a + b, 0);
          const line = (vals: string[], header = false) => {
            if (yy + rowH > doc.page.height - doc.page.margins.bottom) { doc.addPage(); yy = doc.page.margins.top; }
            let x = pageLeft;
            if (header) doc.rect(pageLeft, yy, totalW, rowH).fill('#1F3B73');
            doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).fillColor(header ? '#FFF' : '#111');
            vals.forEach((v, i) => { doc.text(v, x + 1, yy + 3, { width: colW[i] - 2, align: i === 0 ? 'left' : 'center', lineBreak: false, ellipsis: true }); x += colW[i]; });
            yy += rowH;
          };
          line(heads, true);
          for (const rec of recs) line([rec.label, ...gc.map((g) => String(rec.distribution[g] ?? 0)), String(rec.entries), String(rec.meanMarks), gradeOf(rec.meanMarks)]);
          doc.y = yy + 10;
        };

        section('Grade Breakdown (by stream)', 'Class', (merit.summaries.byStream as any[]).map((s) => ({ label: `${s.className ?? ''}${s.stream ? ' ' + s.stream : ''}`.trim() || s.classId, entries: s.entries, meanMarks: s.meanMarks, distribution: s.distribution })));
        section('Class Grade Summary (by subject)', 'Subject', (merit.summaries.bySubject as any[]).map((s) => ({ label: s.subjectName, entries: s.entries, meanMarks: s.meanMarks, distribution: s.distribution })));
        section('Gender Summary', 'Gender', (merit.summaries.byGender as any[]).map((s) => ({ label: s.gender, entries: s.entries, meanMarks: s.meanMarks, distribution: s.distribution })));

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
