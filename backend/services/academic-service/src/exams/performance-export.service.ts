import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { competitionRanks, round } from './engine/result-engine';

// esModuleInterop is off in this service — use the require form for a usable constructor.
import PDFDocument = require('pdfkit');

export interface PerformanceQuery {
  /** Exam window to rank. Without it, the term's report cards are ranked; without either, a plain student list. */
  examWindowId?: string;
  termId?: string;
  academicYearId?: string;
  /** One stream (class) only. */
  classId?: string;
  /** One standard (all streams of a level). */
  level?: number;
  educationStage?: string;
}

export interface PerfSubject {
  label: string;
  percentage: number | null;
  grade: string;
  status: string;
}

export interface PerfRow {
  classId: string;
  className: string;
  stream: string | null;
  level: number | null;
  stage: string;
  studentId: string;
  registrationNumber: string;
  name: string;
  gender: string;
  average: number | null;
  grade: string;
  division: string;
  subjectsAssessed: number | null;
  subjectsExpected: number | null;
  streamRank: number | null;
  streamTotal: number;
  standardRank: number | null;
  standardTotal: number;
  subjects: Record<string, PerfSubject>;
}

export interface PerfStream {
  classId: string;
  label: string;
  stream: string | null;
  rows: PerfRow[];
}

export interface PerfStandard {
  key: string;
  label: string;
  level: number | null;
  stage: string;
  /** Everyone in the standard, highest average first. */
  overall: PerfRow[];
  streams: PerfStream[];
}

export interface PerformanceReport {
  title: string;
  source: 'WINDOW' | 'TERM' | 'ROSTER';
  sourceLabel: string;
  generatedAt: string;
  subjects: Array<{ key: string; label: string }>;
  standards: PerfStandard[];
  totalStudents: number;
}

const STAGE_ORDER: Record<string, number> = { NURSERY: 0, PRIMARY: 1, O_LEVEL: 2, A_LEVEL: 3 };

@Injectable()
export class PerformanceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentClient: StudentClientService,
  ) {}

  private unwrap<T>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const p = payload as Record<string, unknown> | null;
    if (!p) return [];
    const inner = (p.data ?? p) as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as T[];
    for (const c of [inner?.items, inner?.classes, inner?.students]) {
      if (Array.isArray(c)) return c as T[];
    }
    return [];
  }

  private headers(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private studentName(s: any): string {
    return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').trim();
  }

  /** Build the grouped, ranked report (highest average first, per stream and per standard). */
  async build(q: PerformanceQuery, user: RequestUser): Promise<PerformanceReport> {
    let academicYearId = q.academicYearId;
    let source: PerformanceReport['source'] = 'ROSTER';
    let sourceLabel = 'Student list';
    let window: { id: string; name: string; termId: string; academicYearId: string; schoolId: string | null } | null = null;

    if (q.examWindowId) {
      window = await this.prisma.examWindow.findUnique({ where: { id: q.examWindowId }, select: { id: true, name: true, termId: true, academicYearId: true, schoolId: true } });
      if (!window) throw new BadRequestException('Exam window not found.');
      source = 'WINDOW';
      sourceLabel = window.name;
      academicYearId = window.academicYearId;
    } else if (q.termId) {
      source = 'TERM';
      sourceLabel = 'Term report cards';
    }

    const classesPayload = await this.studentClient.get<unknown>('/students/classes', { academicYearId, limit: 1000 }, this.headers(user));
    let classes = this.unwrap<any>(classesPayload).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      level: (c.level ?? null) as number | null,
      stream: (c.stream ?? null) as string | null,
      stage: (c.educationStage ?? 'PRIMARY') as string,
    }));
    if (q.educationStage) classes = classes.filter((c) => c.stage === q.educationStage);

    // ── raw performance rows keyed by student ───────────────────────────
    const perf = new Map<string, { average: number; grade: string; division: string; assessed: number | null; expected: number | null; subjects: Record<string, PerfSubject> }>();
    const subjectCols = new Map<string, string>();

    if (source === 'WINDOW' && window) {
      const rows = await this.prisma.examWindowResult.findMany({ where: { examWindowId: window.id } });
      for (const r of rows) {
        const subjects: Record<string, PerfSubject> = {};
        const scores = (r.subjectScores ?? {}) as Record<string, any>;
        for (const k of Object.keys(scores)) {
          const s = scores[k];
          subjects[s.subjectId] = { label: s.subjectName, percentage: s.percentage ?? null, grade: s.grade ?? '', status: s.status ?? (s.isAbsent ? 'ABSENT' : 'SCORED') };
          subjectCols.set(s.subjectId, s.subjectName);
        }
        perf.set(r.studentId, { average: r.mean, grade: r.overallGrade, division: r.division ?? '', assessed: r.subjectsAssessed, expected: r.subjectsExpected, subjects });
      }
    } else if (source === 'TERM') {
      const cards = await this.prisma.reportCard.findMany({ where: { termId: q.termId, ...schoolScopeFilter(user) } });
      const results = await this.prisma.termResult.findMany({ where: { termId: q.termId, studentId: { in: cards.map((c) => c.studentId) } } });
      const byStudent = new Map<string, typeof results>();
      for (const r of results) {
        const arr = byStudent.get(r.studentId) ?? [];
        arr.push(r);
        byStudent.set(r.studentId, arr as any);
      }
      for (const c of cards) {
        const subjects: Record<string, PerfSubject> = {};
        for (const r of byStudent.get(c.studentId) ?? []) {
          subjects[r.subjectId] = { label: r.subjectName, percentage: r.resultStatus === 'EXEMPT' ? null : r.weightedTotal, grade: r.grade, status: r.resultStatus };
          subjectCols.set(r.subjectId, r.subjectName);
        }
        const ds = (c.divisionSummary ?? {}) as Record<string, any>;
        perf.set(c.studentId, {
          average: c.overallAverage,
          grade: c.overallGrade,
          division: String(ds.division ?? ds.descriptor ?? ''),
          assessed: c.subjectCount,
          expected: c.subjectsExpected || c.subjectCount,
          subjects,
        });
      }
    }

    // ── roster rows (names, gender) for every class in scope ────────────
    const rows: PerfRow[] = [];
    for (const c of classes) {
      const payload = await this.studentClient.get<unknown>('/students', { classId: c.id, limit: 2000, page: 1 }, this.headers(user));
      for (const s of this.unwrap<any>(payload)) {
        const p = perf.get(s.id);
        if (source !== 'ROSTER' && !p) continue; // ranked reports list only students who have a result
        rows.push({
          classId: c.id,
          className: c.name,
          stream: c.stream,
          level: c.level,
          stage: c.stage,
          studentId: s.id,
          registrationNumber: s.registrationNumber ?? '',
          name: this.studentName(s),
          gender: (s.gender ?? '').toString().toUpperCase().slice(0, 1),
          average: p ? round(p.average) : null,
          grade: p?.grade ?? '',
          division: p?.division ?? '',
          subjectsAssessed: p?.assessed ?? null,
          subjectsExpected: p?.expected ?? null,
          streamRank: null,
          streamTotal: 0,
          standardRank: null,
          standardTotal: 0,
          subjects: p?.subjects ?? {},
        });
      }
    }

    // ── group by standard (stage + level) and rank, always on the FULL group ──
    const standardKey = (r: PerfRow) => `${r.stage}::${r.level ?? 'x'}`;
    const byStandard = new Map<string, PerfRow[]>();
    for (const r of rows) {
      const arr = byStandard.get(standardKey(r)) ?? [];
      arr.push(r);
      byStandard.set(standardKey(r), arr);
    }
    const standards: PerfStandard[] = [];
    for (const [key, group] of byStandard.entries()) {
      const first = group[0];
      if (source !== 'ROSTER') {
        const sr = competitionRanks(group, (r) => r.studentId, (r) => r.average ?? 0);
        group.forEach((r) => { r.standardRank = sr[r.studentId]; r.standardTotal = group.length; });
        const byClass = new Map<string, PerfRow[]>();
        group.forEach((r) => byClass.set(r.classId, [...(byClass.get(r.classId) ?? []), r]));
        for (const g of byClass.values()) {
          const cr = competitionRanks(g, (r) => r.studentId, (r) => r.average ?? 0);
          g.forEach((r) => { r.streamRank = cr[r.studentId]; r.streamTotal = g.length; });
        }
      }
      const sortFn = (a: PerfRow, b: PerfRow) =>
        source === 'ROSTER' ? a.name.localeCompare(b.name) : (b.average ?? 0) - (a.average ?? 0) || a.name.localeCompare(b.name);

      // Apply the user's filter AFTER ranking so a single stream still shows its standard position.
      const visible = group.filter((r) => (!q.classId || r.classId === q.classId) && (q.level === undefined || r.level === q.level));
      if (!visible.length) continue;
      const streams: PerfStream[] = [];
      const classIds = [...new Set(visible.map((r) => r.classId))];
      for (const cid of classIds) {
        const sRows = visible.filter((r) => r.classId === cid).sort(sortFn);
        streams.push({ classId: cid, label: `${sRows[0].className}${sRows[0].stream ? ` ${sRows[0].stream}` : ''}`.trim(), stream: sRows[0].stream, rows: sRows });
      }
      streams.sort((a, b) => a.label.localeCompare(b.label));
      standards.push({
        key,
        label: first.level === null ? first.className : `${first.className.replace(/\s+[A-Z]$/, '')}`.trim(),
        level: first.level,
        stage: first.stage,
        overall: [...visible].sort(sortFn),
        streams,
      });
    }
    standards.sort((a, b) => (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) || (a.level ?? 0) - (b.level ?? 0));

    if (!standards.length) {
      throw new BadRequestException(
        source === 'ROSTER'
          ? 'No students found for the selected classes.'
          : 'No results found for that selection yet. Close the exam window (or compose the term report cards) first.',
      );
    }

    return {
      title: source === 'ROSTER' ? 'Student list' : `Student performance — ${sourceLabel}`,
      source,
      sourceLabel,
      generatedAt: new Date().toISOString(),
      subjects: [...subjectCols.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label)),
      standards,
      totalStudents: rows.length,
    };
  }

  // ─── cell helpers ─────────────────────────────────────────────────────
  private cell(s?: PerfSubject): string {
    if (!s) return '';
    if (s.status === 'EXEMPT') return 'EXEMPT';
    if (s.status === 'NOT_SAT') return 'NS';
    if (s.status === 'ABSENT') return 'ABS';
    return s.percentage === null ? '' : `${Math.round(s.percentage)} ${s.grade}`.trim();
  }

  private fileName(report: PerformanceReport, ext: string): string {
    const base = report.source === 'ROSTER' ? 'student-list' : 'student-performance';
    return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  private sheetName(label: string, used: Set<string>): string {
    let n = label.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet';
    let i = 2;
    const base = n;
    while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`;
    used.add(n.toLowerCase());
    return n;
  }

  // ─── XLSX ─────────────────────────────────────────────────────────────
  async buildWorkbook(q: PerformanceQuery, user: RequestUser): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.build(q, user);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kilimanjaro Schools';
    const used = new Set<string>();
    const roster = report.source === 'ROSTER';

    const addSheet = (name: string, title: string, rows: PerfRow[], withStreamCol: boolean) => {
      const ws = wb.addWorksheet(this.sheetName(name, used), { views: [{ state: 'frozen', ySplit: 3 }] });
      const head: string[] = roster
        ? ['#', 'ADMNO', 'NAME', 'GENDER', 'CLASS', 'STREAM']
        : ['STR POS', 'OVR POS', 'ADMNO', 'NAME', 'GENDER', ...(withStreamCol ? ['STREAM'] : []), ...report.subjects.map((s) => s.label), 'SUBJECTS', 'AVG %', 'GRADE', 'DIVISION'];
      ws.mergeCells(1, 1, 1, head.length);
      ws.getCell(1, 1).value = title;
      ws.getCell(1, 1).font = { bold: true, size: 14 };
      ws.addRow([]);
      const hr = ws.addRow(head);
      hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      rows.forEach((r, i) => {
        ws.addRow(
          roster
            ? [i + 1, r.registrationNumber, r.name, r.gender, r.className, r.stream ?? '']
            : [
                r.streamRank, r.standardRank, r.registrationNumber, r.name, r.gender,
                ...(withStreamCol ? [r.stream ?? ''] : []),
                ...report.subjects.map((s) => this.cell(r.subjects[s.key])),
                r.subjectsExpected && r.subjectsAssessed !== r.subjectsExpected ? `${r.subjectsAssessed}/${r.subjectsExpected}` : r.subjectsAssessed ?? '',
                r.average, r.grade, r.division,
              ],
        );
      });
      ws.columns.forEach((c, idx) => { c.width = idx === (roster ? 2 : 3) ? 30 : idx < 5 ? 12 : 11; });
    };

    for (const st of report.standards) {
      if (report.standards.length > 1 || st.streams.length > 1) {
        addSheet(`${st.label} overall`, `${st.label} — all streams, highest to lowest (${report.sourceLabel})`, st.overall, true);
      }
      for (const stream of st.streams) {
        addSheet(stream.label, `${stream.label} — highest to lowest (${report.sourceLabel})`, stream.rows, false);
      }
    }
    const buffer = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    return { filename: this.fileName(report, 'xlsx'), buffer };
  }

  // ─── CSV ──────────────────────────────────────────────────────────────
  async buildCsv(q: PerformanceQuery, user: RequestUser): Promise<{ filename: string; csv: string }> {
    const report = await this.build(q, user);
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const roster = report.source === 'ROSTER';
    const head = roster
      ? ['STANDARD', 'CLASS', 'STREAM', 'ADMNO', 'NAME', 'GENDER']
      : ['STANDARD', 'CLASS', 'STREAM', 'STR POS', 'OVR POS', 'ADMNO', 'NAME', 'GENDER', ...report.subjects.map((s) => s.label), 'SUBJECTS ASSESSED', 'SUBJECTS EXPECTED', 'AVG %', 'GRADE', 'DIVISION'];
    const lines = [head.map(esc).join(',')];
    for (const st of report.standards) {
      for (const stream of st.streams) {
        for (const r of stream.rows) {
          lines.push(
            (roster
              ? [st.label, r.className, r.stream ?? '', r.registrationNumber, r.name, r.gender]
              : [st.label, r.className, r.stream ?? '', r.streamRank, r.standardRank, r.registrationNumber, r.name, r.gender, ...report.subjects.map((s) => this.cell(r.subjects[s.key])), r.subjectsAssessed ?? '', r.subjectsExpected ?? '', r.average, r.grade, r.division]
            ).map(esc).join(','),
          );
        }
      }
    }
    return { filename: this.fileName(report, 'csv'), csv: '﻿' + lines.join('\r\n') + '\r\n' };
  }

  // ─── PDF ──────────────────────────────────────────────────────────────
  async buildPdf(q: PerformanceQuery, user: RequestUser): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.build(q, user);
    const roster = report.source === 'ROSTER';
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 56;
      const cols: Array<{ h: string; w: number; v: (r: PerfRow) => string; align?: 'left' | 'center' }> = roster
        ? [
            { h: '#', w: 28, v: () => '' },
            { h: 'ADMNO', w: 100, v: (r) => r.registrationNumber },
            { h: 'NAME', w: 260, v: (r) => r.name, align: 'left' },
            { h: 'GENDER', w: 50, v: (r) => r.gender },
            { h: 'CLASS', w: 100, v: (r) => r.className },
            { h: 'STREAM', w: 60, v: (r) => r.stream ?? '' },
          ]
        : [
            { h: 'STR', w: 30, v: (r) => String(r.streamRank ?? '') },
            { h: 'OVR', w: 30, v: (r) => String(r.standardRank ?? '') },
            { h: 'ADMNO', w: 90, v: (r) => r.registrationNumber },
            { h: 'NAME', w: 170, v: (r) => r.name, align: 'left' },
            { h: 'SEX', w: 28, v: (r) => r.gender },
            ...report.subjects.slice(0, 9).map((s) => ({ h: s.label.slice(0, 7).toUpperCase(), w: 44, v: (r: PerfRow) => this.cell(r.subjects[s.key]) })),
            { h: 'SBJ', w: 34, v: (r) => (r.subjectsExpected && r.subjectsAssessed !== r.subjectsExpected ? `${r.subjectsAssessed}/${r.subjectsExpected}` : String(r.subjectsAssessed ?? '')) },
            { h: 'AVG %', w: 42, v: (r) => (r.average === null ? '' : r.average.toFixed(1)) },
            { h: 'GR', w: 28, v: (r) => r.grade },
            { h: 'DIVISION', w: 70, v: (r) => r.division.replace('Division ', 'Div ').slice(0, 14) },
          ];
      const scale = Math.min(1, W / cols.reduce((s, c) => s + c.w, 0));

      const table = (title: string, rows: PerfRow[]) => {
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a5f').text(title, 28, 28);
        doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`${rows.length} students · ${roster ? 'alphabetical' : 'highest to lowest average'} · generated ${new Date().toLocaleString()}`, 28, 46);
        let y = 64;
        const header = () => {
          doc.rect(28, y, W, 16).fill('#1e3a5f');
          let x = 28;
          cols.forEach((c) => { doc.fillColor('white').font('Helvetica-Bold').fontSize(7).text(c.h, x + 2, y + 5, { width: c.w * scale - 4, align: c.align ?? 'center', lineBreak: false }); x += c.w * scale; });
          y += 16;
        };
        header();
        rows.forEach((r, i) => {
          if (y > doc.page.height - 40) { doc.addPage(); y = 28; header(); }
          if (i % 2 === 0) doc.rect(28, y, W, 14).fill('#f1f5f9');
          let x = 28;
          cols.forEach((c, ci) => {
            const text = roster && ci === 0 ? String(i + 1) : c.v(r);
            doc.fillColor('#0f172a').font(ci === 3 && !roster ? 'Helvetica-Bold' : 'Helvetica').fontSize(7).text(text, x + 2, y + 4, { width: c.w * scale - 4, align: c.align ?? 'center', lineBreak: false });
            x += c.w * scale;
          });
          y += 14;
        });
      };

      // cover
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#1e3a5f').text('KILIMANJARO SCHOOLS', 28, 150, { width: W, align: 'center' });
      doc.fontSize(14).fillColor('#0f172a').text(report.title, 28, 184, { width: W, align: 'center' });
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(
        `${report.totalStudents} students · ${report.standards.length} standard(s) · generated ${new Date().toLocaleString()}`,
        28, 212, { width: W, align: 'center' },
      );
      for (const st of report.standards) {
        if (st.streams.length > 1) table(`${st.label} — all streams, highest to lowest`, st.overall);
        for (const stream of st.streams) table(`${stream.label} — ${roster ? 'student list' : 'highest to lowest'}`, stream.rows);
      }
      doc.end();
    });
    return { filename: this.fileName(report, 'pdf'), buffer };
  }
}
