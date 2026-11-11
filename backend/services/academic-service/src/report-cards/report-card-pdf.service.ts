import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
// pdfkit publishes a CommonJS constructor; this service's tsconfig has
// esModuleInterop off, so the `= require` form is needed for a usable constructor.
import PDFDocument = require('pdfkit');

// ─── Brand palette (derived from the Kilimanjaro Schools badge) ───────────────
const NAVY = '#0B1F4B';
const NAVY_MID = '#0F3A7A';
const BLUE = '#1F5FA8';
const SKY = '#C9DDF2';
const SKY_SOFT = '#EEF5FC';
const PANEL = '#F3F8FD';
const BORDER = '#B8D1EA';
const GRID = '#CBDCEF';
const RED = '#B5121B';
const MUTED = '#5B6B86';
const INK = '#0F1B3D';
const GREEN = '#16803C';
const GREEN_SOFT = '#EAF8EE';

// ─── Page geometry (A4 portrait, points) ──────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 20;
const CW = PAGE_W - M * 2;
/** Content may not extend below this line: the compact document footer lives underneath. */
const BOTTOM = 794;
const CONTINUATION_TOP = 74;

const TABLE_HEADER_H = 22;
const LABEL_H = 22;

/** Block heights. Dense cards with many subjects switch to the compact set to stay on one page. */
type Metrics = { bar: number; summary: number; note: number; comment: number; division: number; compact: boolean };
const NORMAL: Metrics = { bar: 29, summary: 62, note: 24, comment: 88, division: 52, compact: false };
const COMPACT: Metrics = { bar: 24, summary: 50, note: 20, comment: 66, division: 44, compact: true };
const BLOCK_GAP = 10;
const AFTER_TABLE_GAP = 17;

type PdfResult = {
  subjectName: string;
  subjectRole?: string;
  CAT1?: number;
  CAT2?: number;
  MIDTERM?: number;
  FINAL?: number;
  total: number;
  grade: string;
  remark: string;
  /** SCORED | ABSENT | NOT_SAT | EXEMPT (absent = scored zero; exempt = excluded from every calculation). */
  status?: string;
  gradePoints?: number;
};

type DivisionSummary = {
  mode: string;
  division?: string;
  descriptor: string;
  totalPoints: number;
  principalPasses?: number;
  failingSubjects?: number;
};

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  belowThreshold: boolean;
};

export type ReportCardPdfInput = {
  studentId: string;
  termId: string;
  academicYearId: string;
  studentName: string;
  registrationNumber: string;
  className: string;
  /** Human labels; fall back to id fragments only when unavailable. */
  termName?: string;
  academicYearName?: string;
  generatedAt: Date;
  results: PdfResult[];
  average: number;
  overallGrade: string;
  /** Subjects counted in the average vs. subjects the student was expected to take. */
  subjectsAssessed?: number;
  subjectsExpected?: number;
  failingSubjectCount?: number;
  showSubjectSupport?: boolean;
  reportTemplateCode?: string;
  divisionSummary?: unknown;
  rank?: number | null;
  totalStudents?: number | null;
  overallRank?: number | null;
  totalStudentsOverall?: number | null;
  examLabel?: string | null;
  teacherComment?: string | null;
  principalComment?: string | null;
  internalPerformanceNote?: string;
  attendance?: AttendanceSummary;
  pairingStatus?: string;
  // Primary holistic assessment fields
  behaviourGrade?: string | null;
  socialSkillsGrade?: string | null;
  extraCurricularNote?: string | null;
  readingAbility?: string | null;
  writingAbility?: string | null;
  numeracyAbility?: string | null;
};

type Doc = PDFKit.PDFDocument;
type Ctx = { doc: Doc; y: number; input: ReportCardPdfInput; logo: Buffer | null; u: Metrics };
type Column = { key: string; label: string; w: number; align: 'left' | 'center' };
type Verdict = { label: string; color: string; soft: string; icon: boolean };

/** 24×24 line-icon paths (stroke only), drawn scaled to the requested size. */
const ICONS: Record<string, string[]> = {
  user: ['M20 21 v-2 a4 4 0 0 0 -4 -4 H8 a4 4 0 0 0 -4 4 v2', 'M8 7 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 z'],
  idcard: [
    'M4 5 h16 a2 2 0 0 1 2 2 v10 a2 2 0 0 1 -2 2 H4 a2 2 0 0 1 -2 -2 V7 a2 2 0 0 1 2 -2 z',
    'M14 9.5 h5', 'M14 12.5 h5', 'M14 15.5 h3',
    'M6.5 10.5 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 z', 'M5.5 16.5 c0.6 -1.6 1.8 -2 3 -2 s2.4 0.4 3 2',
  ],
  layers: ['M12 2 L2 7 l10 5 10 -5 z', 'M2 17 l10 5 10 -5', 'M2 12 l10 5 10 -5'],
  calendar: ['M5 4 h14 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 z', 'M16 2 v4', 'M8 2 v4', 'M3 10 h18'],
  trophy: [
    'M8 21 h8', 'M12 17 v4', 'M7 4 h10 v5 a5 5 0 0 1 -10 0 z',
    'M7 6 H4 v1 a3 3 0 0 0 3 3', 'M17 6 h3 v1 a3 3 0 0 1 -3 3',
  ],
  book: [
    'M2 4 h6 a4 4 0 0 1 4 4 v13 a3 3 0 0 0 -3 -3 H2 z',
    'M22 4 h-6 a4 4 0 0 0 -4 4 v13 a3 3 0 0 1 3 -3 h7 z',
  ],
  users: [
    'M17 21 v-2 a4 4 0 0 0 -4 -4 H5 a4 4 0 0 0 -4 4 v2',
    'M5 7 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 z',
    'M23 21 v-2 a4 4 0 0 0 -3 -3.87', 'M16 3.13 a4 4 0 0 1 0 7.75',
  ],
  cap: ['M22 10 L12 5 2 10 l10 5 10 -5 z', 'M6 12 v5 c3 2 9 2 12 0 v-5', 'M22 10 v6'],
  info: ['M2 12 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 z', 'M12 16 v-4', 'M12 8 h0.01'],
  check: ['M20 6 L9 17 l-5 -5'],
};

@Injectable()
export class ReportCardPdfService {
  private static logoCache: Buffer | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  async generatePdf(input: ReportCardPdfInput): Promise<string> {
    const storageRoot = this.configService.get<string>('PDF_STORAGE_PATH', './storage/report-cards');
    const fileName = `report_${input.studentId}_${input.termId}.pdf`;
    const filePath = join(storageRoot, fileName);
    mkdirSync(dirname(filePath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
          Title: `Academic Report Card - ${input.studentName}`,
          Author: 'Kilimanjaro Schools',
          Subject: `${input.termName ?? 'Term'} ${input.academicYearName ?? ''}`.trim(),
        },
      });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      const ctx: Ctx = { doc, y: 0, input, logo: this.loadLogo(), u: NORMAL };
      const template = input.reportTemplateCode ?? 'O_LEVEL_TERM';

      this.renderHeader(ctx);
      this.renderBody(ctx, template);
      this.renderPageDecor(ctx);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    return fileName;
  }

  // ─── Assets ────────────────────────────────────────────────────────────────

  /** The Kilimanjaro Schools badge used by the mobile and dashboard apps. */
  private loadLogo(): Buffer | null {
    if (ReportCardPdfService.logoCache !== undefined) return ReportCardPdfService.logoCache;
    const candidates = [
      join(__dirname, 'assets', 'kilimanjaro_logo.png'),
      join(process.cwd(), 'src', 'report-cards', 'assets', 'kilimanjaro_logo.png'),
      join(process.cwd(), 'dist', 'src', 'report-cards', 'assets', 'kilimanjaro_logo.png'),
      join(process.cwd(), 'backend', 'services', 'academic-service', 'src', 'report-cards', 'assets', 'kilimanjaro_logo.png'),
    ];
    const found = candidates.find((p) => existsSync(p));
    ReportCardPdfService.logoCache = found ? readFileSync(found) : null;
    return ReportCardPdfService.logoCache;
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  private renderHeader(ctx: Ctx) {
    const { doc, input } = ctx;

    this.drawSwoosh(doc);

    // Badge
    this.drawLogo(ctx, 22, 20, 116);

    // Divider
    doc.save().moveTo(160, 28).lineTo(160, 134).lineWidth(1).strokeColor('#C9D6E6').stroke().restore();

    // Title
    const titleX = 176;
    const titleMaxW = 306;
    let titleSize = 36;
    doc.font('Times-Bold').fontSize(titleSize);
    const wide = doc.widthOfString('KILIMANJARO');
    if (wide > titleMaxW) titleSize = (titleSize * titleMaxW) / wide;
    doc.fillColor(NAVY).font('Times-Bold').fontSize(titleSize);
    doc.text('KILIMANJARO', titleX, 33, { lineBreak: false });
    doc.text('SCHOOLS', titleX, 33 + titleSize * 0.97, { lineBreak: false });

    // Red rule
    doc.save().roundedRect(titleX + 1, 111, 62, 3, 1.5).fill(RED).restore();

    // Subtitle: STAGE • ACADEMIC REPORT CARD
    this.drawSubtitle(doc, titleX, 122, 318, this.stageLabelFor(input.reportTemplateCode));
    if (input.examLabel?.trim()) {
      const label = `EXAM: ${input.examLabel.trim().toUpperCase()}`;
      const exam = this.fitText(doc, label, 'Helvetica-Bold', 8.5, 306, 6.5);
      doc.font('Helvetica-Bold').fontSize(exam.size).fillColor(RED)
        .text(exam.text, titleX, 139, { width: 306, align: 'left', lineBreak: false });
    }

    // Term ribbon
    this.drawTermRibbon(ctx, 503, 40, 72, 102);

    this.renderStudentPanel(ctx, 156);
    ctx.y = 156 + 90 + 16;
  }

  private drawSwoosh(doc: Doc) {
    doc.save();
    // Pale sky wash behind the sweep
    const wash = doc.linearGradient(250, 0, PAGE_W, 0);
    wash.stop(0, '#EAF4FC', 0).stop(1, '#DCEBF8', 1);
    doc.path(`M 250 0 L ${PAGE_W} 0 L ${PAGE_W} 34 C 500 33 380 22 250 0 Z`).fill(wash);
    // Sky-blue sweep
    const blue = doc.linearGradient(262, 0, PAGE_W, 28);
    blue.stop(0, '#A8D3F2').stop(0.5, '#3C86CC').stop(1, '#0F3A7A');
    doc.path(`M 262 0 L ${PAGE_W} 0 L ${PAGE_W} 28 C 510 26 390 15 262 0 Z`).fill(blue);
    // Red stripe
    doc.path(`M 268 1 C 392 17 512 29 ${PAGE_W} 31 L ${PAGE_W} 36 C 512 34 392 22 262 3 Z`).fill(RED);
    // Fine light line beneath the red
    doc.path(`M 262 3 C 392 22 512 34 ${PAGE_W} 36 L ${PAGE_W} 38 C 512 36 392 25 258 5 Z`).fill('#9CC9EE');
    doc.restore();
  }

  private drawLogo(ctx: Ctx, x: number, y: number, size: number) {
    const { doc, logo } = ctx;
    if (logo) {
      doc.image(logo, x, y, { width: size, height: size });
      return;
    }
    // Fallback so a missing asset never blocks report generation.
    doc.save();
    doc.circle(x + size / 2, y + size / 2, size / 2).fill('#25A5E0');
    doc.fillColor('white').font('Times-Bold').fontSize(size * 0.45)
      .text('K', x, y + size * 0.26, { width: size, align: 'center', lineBreak: false });
    doc.restore();
  }

  private drawSubtitle(doc: Doc, x: number, y: number, maxW: number, stage: string) {
    const spacing = 1.1;
    const tail = 'ACADEMIC REPORT CARD';
    let size = 10.5;
    const measure = (s: number) => {
      doc.font('Helvetica-Bold').fontSize(s);
      return (
        doc.widthOfString(stage) + stage.length * spacing +
        doc.widthOfString(tail) + tail.length * spacing + 22
      );
    };
    while (size > 6.5 && measure(size) > maxW) size -= 0.25;

    doc.font('Helvetica-Bold').fontSize(size).fillColor(NAVY);
    const stageW = doc.widthOfString(stage) + stage.length * spacing;
    doc.text(stage, x, y, { characterSpacing: spacing, lineBreak: false });
    const dotX = x + stageW + 10;
    doc.save().circle(dotX, y + size * 0.45, 1.9).fill(RED).restore();
    doc.fillColor(NAVY).text(tail, dotX + 10, y, { characterSpacing: spacing, lineBreak: false });
  }

  private drawTermRibbon(ctx: Ctx, x: number, y: number, w: number, h: number) {
    const { doc, input } = ctx;
    const notch = 15;
    const shape = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x + w / 2} ${y + h - notch} L ${x} ${y + h} Z`;

    doc.save();
    // Soft drop shadow
    doc.save().translate(1.5, 2).path(shape).fillOpacity(0.18).fill('#0B1F4B').restore();
    const grad = doc.linearGradient(x, y, x + w, y + h);
    grad.stop(0, '#163C7A').stop(1, NAVY);
    doc.path(shape).fill(grad);
    // Red chevron edge
    doc.path(`M ${x} ${y + h + 3} L ${x + w / 2} ${y + h - notch + 3} L ${x + w} ${y + h + 3}`)
      .lineWidth(2.4).strokeColor(RED).stroke();
    doc.restore();

    const termLabel = input.termName ?? '';
    const digits = /(\d+)/.exec(termLabel)?.[1];
    const year = input.academicYearName ?? '';
    const cx = x;
    doc.fillColor('white');
    doc.font('Helvetica-Bold').fontSize(11.5)
      .text('TERM', cx, y + 13, { width: w, align: 'center', characterSpacing: 1, lineBreak: false });
    if (digits && /^term\b/i.test(termLabel.trim())) {
      doc.font('Times-Bold').fontSize(28).text(digits, cx, y + 27, { width: w, align: 'center', lineBreak: false });
    } else {
      // Non-numeric term label (e.g. "Second Semester"): fit it instead of inventing a digit.
      this.fitText(doc, termLabel.replace(/^term\s*/i, '') || '-', 'Times-Bold', 18, w - 10, 7);
      doc.text(termLabel.replace(/^term\s*/i, '') || '-', cx + 5, y + 32, { width: w - 10, align: 'center', lineBreak: false });
    }
    doc.font('Helvetica').fontSize(9).text('/', cx, y + 58, { width: w, align: 'center', lineBreak: false });
    this.fitText(doc, year, 'Helvetica-Bold', 14, w - 8, 7);
    doc.text(year, cx + 4, y + 70, { width: w - 8, align: 'center', lineBreak: false });
    doc.fillColor(INK);
  }

  private stageLabelFor(template?: string): string {
    switch (template) {
      case 'PRIMARY_STANDARD':        return 'PRIMARY SCHOOL';
      case 'O_LEVEL_TERM':            return 'SECONDARY SCHOOL (O-LEVEL)';
      case 'O_LEVEL_NATIONAL_READY':  return 'FORM FOUR · CSEE READINESS';
      case 'A_LEVEL_COMBINATION':     return 'ADVANCED LEVEL (A-LEVEL)';
      case 'A_LEVEL_NATIONAL_READY':  return 'FORM SIX · ACSEE READINESS';
      default:                         return 'ACADEMIC';
    }
  }

  // ─── Student panel ─────────────────────────────────────────────────────────

  private renderStudentPanel(ctx: Ctx, top: number) {
    const { doc, input } = ctx;
    const h = 90;
    const grad = doc.linearGradient(M, top, M, top + h);
    grad.stop(0, '#F7FBFF').stop(1, '#EAF3FC');
    doc.save().roundedRect(M, top, CW, h, 12).fill(grad).restore();
    doc.save().roundedRect(M, top, CW, h, 12).lineWidth(1).strokeColor(BORDER).stroke().restore();

    // The first column is the widest so long student names get room before they have to wrap.
    const colWs = [0.4, 0.32, 0.28].map((r) => r * CW);
    const colXs = [M, M + colWs[0], M + colWs[0] + colWs[1]];
    const rowH = h / 2;
    const termLabel = input.termName ?? `Term ID: ${input.termId.slice(-8)}`;
    const yearLabel = input.academicYearName ?? `Year: ${input.academicYearId.slice(-8)}`;
    const position = input.rank ? `${input.rank} / ${input.totalStudents ?? '-'}` : '—';

    const cells: Array<[string, string, string]> = [
      ['user', 'STUDENT', input.studentName],
      ['idcard', 'REG. NO.', input.registrationNumber],
      ['layers', 'CLASS', input.className],
      ['calendar', 'TERM', termLabel],
      ['calendar', 'YEAR', yearLabel],
      ['trophy', 'STREAM POSITION', position],
    ];

    // Row divider
    doc.save().moveTo(M + 16, top + rowH).lineTo(M + CW - 16, top + rowH)
      .lineWidth(0.8).strokeColor('#BCD3EA').stroke().restore();

    cells.forEach(([icon, label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = colXs[col];
      const colW = colWs[col];
      const cy = top + row * rowH;
      const mid = cy + rowH / 2;

      if (col > 0) {
        doc.save().moveTo(cx, mid - 15).lineTo(cx, mid + 15).lineWidth(0.8).strokeColor('#BCD3EA').stroke().restore();
      }
      doc.save().roundedRect(cx + 14, mid - 15, 30, 30, 8).fill('#DCEAF8').restore();
      this.icon(doc, icon, cx + 21, mid - 8, 16, BLUE, 1.7);

      const textX = cx + 52;
      const textW = colW - 52 - 10;
      // Long values shrink a little, then wrap onto a second line, and only then truncate.
      const v = this.fitLines(doc, value, 'Helvetica-Bold', 12.5, textW, 2, 8.5);
      const wrapped = v.lines > 1;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED)
        .text(label, textX, wrapped ? mid - 19 : mid - 15, { characterSpacing: 0.7, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(v.size).fillColor(NAVY)
        .text(v.text, textX, wrapped ? mid - 8.5 : mid - 3, { width: textW, lineGap: -1 });
    });
    doc.fillColor(INK);
  }

  // ─── Body ──────────────────────────────────────────────────────────────────

  private renderBody(ctx: Ctx, template: string) {
    const { input } = ctx;
    const ds = input.divisionSummary as DivisionSummary | undefined;
    const plan = this.planLayout(input, template);
    ctx.u = plan.u;
    const rowH = plan.rowH;

    if (template === 'PRIMARY_STANDARD') {
      this.renderResultsTable(ctx, 'SUBJECT PERFORMANCE', input.results, ['Subject', 'CAT1', 'CAT2', 'Total', 'Grade', 'Remark'], rowH);
    } else if (template === 'O_LEVEL_NATIONAL_READY') {
      this.renderResultsTable(
        ctx, 'CSEE READINESS — SUBJECT RESULTS (NECTA GRADING)', input.results,
        ['Subject', 'CAT1', 'CAT2', 'Midterm', 'Final', 'Total', 'Grade', 'Grade Pts', 'Remark'], rowH, true,
      );
    } else if (template === 'A_LEVEL_NATIONAL_READY' || template === 'A_LEVEL_COMBINATION') {
      const isNational = template === 'A_LEVEL_NATIONAL_READY';
      const { principal, subsidiary } = this.splitALevel(input.results);
      if (principal.length > 0) {
        this.renderResultsTable(ctx, 'PRINCIPAL SUBJECTS', principal, ['Subject', 'CAT1', 'Midterm', 'Final', 'Total', 'Grade', 'Grade Pts', 'Remark'], rowH, isNational);
      }
      if (subsidiary.length > 0) {
        if (principal.length > 0) ctx.y += BLOCK_GAP;
        this.renderResultsTable(ctx, 'SUBSIDIARY / GENERAL STUDIES', subsidiary, ['Subject', 'CAT1', 'Midterm', 'Final', 'Total', 'Grade', 'Remark'], rowH, false);
      }
    } else {
      // O_LEVEL_TERM (default)
      this.renderResultsTable(ctx, 'SUBJECT RESULTS', input.results, ['Subject', 'CAT1', 'CAT2', 'Midterm', 'Final', 'Total', 'Grade', 'Remark'], rowH);
    }

    ctx.y += AFTER_TABLE_GAP;

    const showDivision = ds?.division && (template === 'O_LEVEL_NATIONAL_READY' || template === 'A_LEVEL_NATIONAL_READY');
    if (showDivision) {
      this.renderDivisionBox(ctx, ds as DivisionSummary, template === 'A_LEVEL_NATIONAL_READY' ? 'A_LEVEL' : 'O_LEVEL');
      ctx.y += BLOCK_GAP;
    }

    this.renderSummary(ctx, template);
    ctx.y += BLOCK_GAP;

    if (this.hasAssessmentNote(input)) {
      this.renderAssessmentNote(ctx);
      ctx.y += BLOCK_GAP;
    }

    this.renderComments(ctx);
  }

  private splitALevel(results: PdfResult[]) {
    return {
      principal: results.filter((r) => r.subjectRole === 'PRINCIPAL' || !r.subjectRole),
      subsidiary: results.filter((r) => r.subjectRole === 'SUBSIDIARY' || r.subjectRole === 'COMPULSORY_SUBSIDIARY'),
    };
  }

  // ─── Layout planning ───────────────────────────────────────────────────────

  private holisticFields(input: ReportCardPdfInput): Array<[string, string]> {
    const fields: Array<[string, string | null | undefined]> = [
      ['Behaviour', input.behaviourGrade],
      ['Social Skills', input.socialSkillsGrade],
      ['Reading', input.readingAbility],
      ['Writing', input.writingAbility],
      ['Numeracy', input.numeracyAbility],
      ['Extra-Curricular', input.extraCurricularNote],
    ];
    return fields.filter((f): f is [string, string] => !!f[1]);
  }

  private hasAssessmentNote(input: ReportCardPdfInput) {
    return input.subjectsExpected !== undefined && input.subjectsAssessed !== undefined;
  }

  /** Height of everything drawn after the results table(s), used to size rows so a typical card stays on one page. */
  private heightBelowTables(input: ReportCardPdfInput, template: string, u: Metrics): number {
    const ds = input.divisionSummary as DivisionSummary | undefined;
    let h = AFTER_TABLE_GAP;
    if (ds?.division && (template === 'O_LEVEL_NATIONAL_READY' || template === 'A_LEVEL_NATIONAL_READY')) h += u.division + BLOCK_GAP;
    h += u.summary + BLOCK_GAP;
    if (this.hasAssessmentNote(input)) h += u.note + BLOCK_GAP;
    h += LABEL_H + u.comment;
    return h;
  }

  private planLayout(input: ReportCardPdfInput, template: string): { rowH: number; u: Metrics } {
    const isALevel = template === 'A_LEVEL_NATIONAL_READY' || template === 'A_LEVEL_COMBINATION';
    let rows = input.results.length;
    let tables = 1;
    if (isALevel) {
      const { principal, subsidiary } = this.splitALevel(input.results);
      rows = principal.length + subsidiary.length;
      tables = (principal.length > 0 ? 1 : 0) + (subsidiary.length > 0 ? 1 : 0) || 1;
    }
    rows = Math.max(rows, 1);
    const tableTop = 156 + 90 + 16; // below the student panel

    // Prefer the roomy layout, then the compact one. Compact rows remain readable at 13.5pt.
    for (const u of [NORMAL, COMPACT]) {
      const overhead = tables * (u.bar + 6 + TABLE_HEADER_H) + (tables - 1) * BLOCK_GAP;
      const available = BOTTOM - tableTop - overhead - this.heightBelowTables(input, template, u);
      const fitted = Math.floor((available / rows) * 2) / 2;
      const minimum = u.compact ? 13.5 : 15;
      if (fitted >= minimum) return { rowH: Math.min(20, fitted), u };
    }
    // Too many subjects for one page: keep the roomy layout, use a readable row height and paginate.
    return { rowH: 18, u: NORMAL };
  }

  // ─── Page decoration ───────────────────────────────────────────────────────

  private newPage(ctx: Ctx) {
    const { doc, input } = ctx;
    doc.addPage();
    this.drawLogo(ctx, M + 2, 14, 40);
    doc.font('Times-Bold').fontSize(16).fillColor(NAVY).text('KILIMANJARO SCHOOLS', M + 52, 16, { lineBreak: false });
    const term = [input.termName, input.academicYearName].filter(Boolean).join(' ');
    const sub = [input.studentName, input.registrationNumber, input.className, term].filter(Boolean).join('   ·   ');
    this.fitText(doc, sub, 'Helvetica', 8.5, CW - 60, 6);
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(sub, M + 52, 38, { lineBreak: false });
    doc.save().rect(M, 62, CW * 0.7, 1.5).fill(NAVY_MID).restore();
    doc.save().rect(M + CW * 0.7, 62, CW * 0.3, 1.5).fill(RED).restore();
    ctx.y = CONTINUATION_TOP;
  }

  private ensureSpace(ctx: Ctx, h: number) {
    if (ctx.y + h > BOTTOM) this.newPage(ctx);
  }

  /** Compact document footer, drawn on every page once pagination is known. */
  private renderPageDecor(ctx: Ctx) {
    const { doc, input } = ctx;
    const range = doc.bufferedPageRange();
    const date = input.generatedAt.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
    });

    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);

      doc.save();
      doc.rect(0, 805, PAGE_W, PAGE_H - 805).fill(PANEL);
      doc.rect(M, 805, CW * 0.72, 1.5).fill(NAVY_MID);
      doc.rect(M + CW * 0.72, 805, CW * 0.28, 1.5).fill(RED);
      doc.restore();

      const parts = [`Generated ${date}`, 'Official Academic Document', input.registrationNumber];
      if (range.count > 1) parts.push(`Page ${i + 1} of ${range.count}`);
      const text = parts.join('   |   ');
      doc.font('Helvetica').fontSize(9);
      const tw = doc.widthOfString(text);
      const tx = (PAGE_W - tw) / 2;
      const ty = 817;
      doc.fillColor(NAVY).text(text, tx, ty, { lineBreak: false });
    }
  }

  // ─── Section bar / label ───────────────────────────────────────────────────

  private renderSectionBar(ctx: Ctx, title: string, icon: string) {
    const { doc } = ctx;
    const y = ctx.y;
    const grad = doc.linearGradient(M, y, M + CW, y);
    grad.stop(0, NAVY).stop(0.6, NAVY_MID).stop(1, '#2A6DB8');

    doc.save();
    doc.roundedRect(M, y, CW, ctx.u.bar, 6).clip();
    doc.rect(M, y, CW, ctx.u.bar).fill(grad);
    // Diagonal red + white accent on the right
    const ax = M + CW - 96;
    doc.path(`M ${ax} ${y + ctx.u.bar} L ${ax + 46} ${y} L ${ax + 58} ${y} L ${ax + 12} ${y + ctx.u.bar} Z`).fill(RED);
    doc.path(`M ${ax + 14} ${y + ctx.u.bar} L ${ax + 60} ${y} L ${ax + 64} ${y} L ${ax + 18} ${y + ctx.u.bar} Z`).fill('#DDEBFA');
    doc.restore();

    this.icon(doc, icon, M + 14, y + 6, 17, 'white', 1.6);
    doc.font('Helvetica-Bold').fontSize(12.5).fillColor('white')
      .text(title, M + 42, y + (ctx.u.bar - 12.5) / 2 - 0.5, { characterSpacing: 0.5, lineBreak: false });
    doc.fillColor(INK);
    ctx.y = y + ctx.u.bar + 6;
  }

  private renderLabel(ctx: Ctx, title: string) {
    const { doc } = ctx;
    const y = ctx.y;
    doc.save().path(`M ${M + 5} ${y + 2} L ${M + 22} ${y + 2} L ${M + 17} ${y + 14} L ${M} ${y + 14} Z`).fill(RED).restore();
    doc.font('Helvetica-Bold').fontSize(12.5).fillColor(NAVY)
      .text(title, M + 28, y + 1.5, { characterSpacing: 0.2, lineBreak: false });
    doc.fillColor(INK);
    ctx.y = y + LABEL_H;
  }

  // ─── Results table ─────────────────────────────────────────────────────────

  private columnsFor(headers: string[]): Column[] {
    const weight = (h: string) => {
      switch (h) {
        case 'Subject': return 3.4;
        case 'Total': return 1.15;
        case 'Grade': return 1.1;
        case 'Grade Pts': return 1.3;
        case 'Midterm': return 1.2;
        case 'Remark': return 1.9;
        default: return 1.0;
      }
    };
    const sum = headers.reduce((s, h) => s + weight(h), 0);
    return headers.map((h) => ({
      key: h,
      label: h === 'CAT1' ? 'CAT 1' : h === 'CAT2' ? 'CAT 2' : h,
      w: (CW * weight(h)) / sum,
      align: h === 'Subject' ? 'left' : 'center',
    }));
  }

  private renderResultsTable(
    ctx: Ctx,
    title: string,
    rows: PdfResult[],
    headers: string[],
    rowH: number,
    showGradePoints = false,
  ) {
    const { doc } = ctx;
    const cols = this.columnsFor(headers);

    // Keep the bar, the header and at least two rows together.
    this.ensureSpace(ctx, ctx.u.bar + 6 + TABLE_HEADER_H + rowH * 2);
    this.renderSectionBar(ctx, title, 'book');

    let segTop = ctx.y;
    const drawHeader = () => {
      segTop = ctx.y;
      doc.save().rect(M, ctx.y, CW, TABLE_HEADER_H).fill(SKY).restore();
      let x = M;
      for (const c of cols) {
        this.cellText(doc, c.label, x, ctx.y, c.w, TABLE_HEADER_H, 'Helvetica-Bold', cols.length > 7 ? 9 : 9.5, NAVY, c.align);
        x += c.w;
      }
      ctx.y += TABLE_HEADER_H;
    };
    const closeSegment = () => {
      // Column rules and outer border for the rows drawn on this page.
      let x = M;
      doc.save().lineWidth(0.6).strokeColor(GRID);
      for (let i = 0; i < cols.length - 1; i++) {
        x += cols[i].w;
        doc.moveTo(x, segTop).lineTo(x, ctx.y).stroke();
      }
      doc.restore();
      doc.save().rect(M, segTop, CW, ctx.y - segTop).lineWidth(0.9).strokeColor(BORDER).stroke().restore();
    };

    drawHeader();

    if (rows.length === 0) {
      doc.save().rect(M, ctx.y, CW, rowH + 4).fill('white').restore();
      this.cellText(doc, 'No results recorded for this term.', M, ctx.y, CW, rowH + 4, 'Helvetica-Oblique', 9, MUTED, 'center');
      ctx.y += rowH + 4;
      closeSegment();
      return;
    }

    rows.forEach((row, idx) => {
      if (ctx.y + rowH > BOTTOM) {
        closeSegment();
        this.newPage(ctx);
        drawHeader();
      }
      const y = ctx.y;
      doc.save().rect(M, y, CW, rowH).fill(idx % 2 === 0 ? 'white' : SKY_SOFT).restore();
      if (idx > 0) doc.save().moveTo(M, y).lineTo(M + CW, y).lineWidth(0.4).strokeColor('#DCE8F5').stroke().restore();

      const isExempt = row.status === 'EXEMPT';
      const isFailing = !isExempt && !this.isPassingGrade(row.grade);
      const values = this.rowValues(row, headers, showGradePoints);

      let x = M;
      cols.forEach((c, i) => {
        let font = 'Helvetica';
        let size = 9;
        let color = INK;
        if (c.key === 'Subject') { font = 'Helvetica-Bold'; size = 9.5; color = NAVY; }
        else if (c.key === 'Total') { font = isExempt ? 'Helvetica' : 'Helvetica-Bold'; size = 9.5; }
        else if (c.key === 'Grade') { font = isExempt ? 'Helvetica' : 'Times-Bold'; size = isExempt ? 9 : 11.5; }
        if (isFailing && c.key !== 'Subject') color = RED;
        if (isExempt && c.key !== 'Subject') { color = MUTED; }
        this.cellText(doc, values[i], x, y, c.w, rowH, font, size, color, c.align);
        x += c.w;
      });
      ctx.y += rowH;
    });
    closeSegment();
  }

  private rowValues(row: PdfResult, headers: string[], showGradePoints: boolean): string[] {
    if (row.status === 'EXEMPT') {
      return headers.map((h) => (h === 'Subject' ? row.subjectName : h === 'Total' || h === 'Grade' ? 'EXEMPT' : h === 'Remark' ? 'Exempt' : '-'));
    }
    if (row.status === 'ABSENT' || row.status === 'NOT_SAT') {
      return headers.map((h) => (h === 'Subject' ? row.subjectName : '-'));
    }
    return headers.map((h) => {
      switch (h) {
        case 'Subject':     return row.subjectName;
        case 'CAT1':        return row.CAT1 != null ? row.CAT1.toFixed(1) : '-';
        case 'CAT2':        return row.CAT2 != null ? row.CAT2.toFixed(1) : '-';
        case 'Midterm':     return row.MIDTERM != null ? row.MIDTERM.toFixed(1) : '-';
        case 'Final':       return row.FINAL != null ? row.FINAL.toFixed(1) : '-';
        case 'Total':       return row.total.toFixed(1);
        case 'Grade':       return row.grade;
        case 'Grade Pts':   return showGradePoints ? String(row.gradePoints ?? '-') : '-';
        case 'Remark':      return row.remark;
        default:            return '-';
      }
    });
  }

  private isPassingGrade(grade: string): boolean {
    return !['F', 'E', 'S'].includes(grade.toUpperCase());
  }

  // ─── Summary strip ─────────────────────────────────────────────────────────

  private verdictFor(input: ReportCardPdfInput, template: string): Verdict | null {
    const ds = input.divisionSummary as DivisionSummary | undefined;
    const good: Pick<Verdict, 'color' | 'soft'> = { color: GREEN, soft: GREEN_SOFT };
    const bad: Pick<Verdict, 'color' | 'soft'> = { color: '#B42318', soft: '#FDECEA' };

    if (template === 'PRIMARY_STANDARD') {
      const label = ds?.descriptor ?? (input.average >= 50 ? 'Promotable' : 'Needs intervention');
      const negative = /^(not|needs|repeat|fail|below)/i.test(label.trim());
      return { label, ...(negative ? bad : good), icon: !negative };
    }
    if (ds?.division) {
      const color = this.divisionColor(ds.division);
      return { label: ds.division, color, soft: '#F5F8FC', icon: false };
    }
    if (ds?.descriptor) return { label: ds.descriptor, ...good, icon: true };
    return null;
  }

  private renderSummary(ctx: Ctx, template: string) {
    const { doc, input } = ctx;
    this.ensureSpace(ctx, ctx.u.summary);
    const y = ctx.y;

    const grad = doc.linearGradient(M, y, M, y + ctx.u.summary);
    grad.stop(0, '#FFFFFF').stop(1, '#EDF4FB');
    doc.save().roundedRect(M, y, CW, ctx.u.summary, 10).fill(grad).restore();
    doc.save().roundedRect(M, y, CW, ctx.u.summary, 10).lineWidth(1).strokeColor(BORDER).stroke().restore();

    const widths = [0.18, 0.14, 0.18, 0.18, 0.32].map((r) => r * CW);
    const position = input.rank ? `${input.rank} / ${input.totalStudents ?? '-'}` : '—';
    const overallPosition = input.overallRank ? `${input.overallRank} / ${input.totalStudentsOverall ?? '-'}` : '—';
    const verdict = this.verdictFor(input, template);
    const stats: Array<[string, string]> = [
      ['Overall Average', `${input.average.toFixed(1)}%`],
      ['Overall Grade', input.overallGrade],
      ['Stream Position', position],
      ['Overall Position', overallPosition],
    ];

    const compact = ctx.u.compact;
    const labelY = compact ? 7 : 9;
    const valueY = compact ? 20 : 23;
    const valueSize = compact ? 24 : 27;
    let x = M;
    stats.forEach(([label, value], i) => {
      const w = widths[i];
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
        .text(label, x, y + labelY, { width: w, align: 'center', lineBreak: false });
      const t = this.fitText(doc, value, 'Times-Bold', valueSize, w - 16, 14);
      doc.font('Times-Bold').fontSize(t.size).fillColor(RED)
        .text(t.text, x, y + valueY + (valueSize - t.size) * 0.4, { width: w, align: 'center', lineBreak: false });
      x += w;
      doc.save().moveTo(x, y + 10).lineTo(x, y + ctx.u.summary - 10).lineWidth(0.8).strokeColor(BORDER).stroke().restore();
    });

    // Final cell: verdict pill or assessed-subject count
    const finalWidth = widths[4];
    if (verdict) {
      const pw = Math.min(finalWidth - 26, 170);
      const ph = compact ? 30 : 34;
      const px = x + (finalWidth - pw) / 2;
      const py = y + (ctx.u.summary - ph) / 2;
      doc.save().roundedRect(px, py, pw, ph, 9).fill(verdict.soft).restore();
      doc.save().roundedRect(px, py, pw, ph, 9).lineWidth(1.2).strokeColor(verdict.color).stroke().restore();
      if (verdict.icon) {
        doc.save().circle(px + 18, py + ph / 2, 10).fill(verdict.color).restore();
        this.icon(doc, 'check', px + 12, py + ph / 2 - 6, 12, 'white', 3);
      }
      const label = verdict.label.toUpperCase();
      const textX = verdict.icon ? px + 34 : px + 8;
      const textW = verdict.icon ? pw - 40 : pw - 16;
      const t = this.fitText(doc, label, 'Helvetica-Bold', 13, textW - 4, 7.5);
      doc.font('Helvetica-Bold').fontSize(t.size).fillColor(verdict.color)
        .text(t.text, textX, py + (ph - t.size) / 2 - 0.5, { width: textW, align: 'center', lineBreak: false });
    } else if (input.subjectsAssessed !== undefined && input.subjectsExpected !== undefined) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
        .text('Subjects Assessed', x, y + labelY, { width: finalWidth, align: 'center', lineBreak: false });
      doc.font('Times-Bold').fontSize(valueSize).fillColor(RED)
        .text(`${input.subjectsAssessed} / ${input.subjectsExpected}`, x, y + valueY, { width: finalWidth, align: 'center', lineBreak: false });
    }
    doc.fillColor(INK);
    ctx.y = y + ctx.u.summary;
  }

  private renderAssessmentNote(ctx: Ctx) {
    const { doc, input } = ctx;
    this.ensureSpace(ctx, ctx.u.note);
    const y = ctx.y;
    const assessed = input.subjectsAssessed as number;
    const expected = input.subjectsExpected as number;
    const exempt = expected - assessed;
    const assessmentText =
      exempt > 0
        ? `Subjects assessed: ${assessed} of ${expected}. Average calculated from ${assessed} subject${assessed === 1 ? '' : 's'} (${exempt} exempt).`
        : `Subjects assessed: ${assessed} of ${expected}.`;
    const supportCount = input.showSubjectSupport ? input.failingSubjectCount ?? 0 : 0;
    const text = supportCount > 0
      ? `${assessmentText} Support needed in ${supportCount} subject${supportCount === 1 ? '' : 's'}.`
      : assessmentText;

    doc.save().roundedRect(M, y, CW, ctx.u.note, 9).fill('#E6F0FA').restore();
    this.icon(doc, 'info', M + 12, y + 5, 14, NAVY, 1.7);
    const t = this.fitText(doc, text, 'Helvetica-Oblique', 9.5, CW - 56, 7);
    doc.font('Helvetica-Oblique').fontSize(t.size).fillColor(NAVY)
      .text(t.text, M + 34, y + (ctx.u.note - t.size) / 2 - 0.5, { lineBreak: false });
    doc.fillColor(INK);
    ctx.y = y + ctx.u.note;
  }

  // ─── Division banner (national-readiness layouts) ──────────────────────────

  private renderDivisionBox(ctx: Ctx, ds: DivisionSummary, mode: 'O_LEVEL' | 'A_LEVEL') {
    const { doc } = ctx;
    const h = ctx.u.division;
    const compact = ctx.u.compact;
    this.ensureSpace(ctx, h);
    const y = ctx.y;
    const color = this.divisionColor(ds.division);

    doc.save().roundedRect(M, y, CW, h, 10).fill(color).restore();
    doc.save().roundedRect(M, y, CW, h, 10).clip();
    doc.path(`M ${M + CW - 120} ${y + h} L ${M + CW - 70} ${y} L ${M + CW - 52} ${y} L ${M + CW - 102} ${y + h} Z`).fillOpacity(0.16).fill('white');
    doc.restore();

    const title = mode === 'A_LEVEL' ? 'ACSEE DIVISION PROJECTION' : 'CSEE DIVISION PROJECTION';
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
      .text(title, M + 16, y + (compact ? 7 : 9), { characterSpacing: 0.8, lineBreak: false });
    doc.font('Times-Bold').fontSize(compact ? 19 : 22).fillColor('white')
      .text(ds.division ?? 'Ungraded', M + 16, y + (compact ? 18 : 21), { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('white')
      .text(ds.descriptor, M + 150, y + (compact ? 21 : 23), { width: CW - 150 - 130, lineBreak: false });
    if (typeof ds.totalPoints === 'number') {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
        .text('TOTAL POINTS', M + CW - 112, y + (compact ? 8 : 11), { width: 96, align: 'right', characterSpacing: 0.6, lineBreak: false });
      doc.font('Times-Bold').fontSize(compact ? 17 : 20)
        .text(String(ds.totalPoints), M + CW - 112, y + (compact ? 19 : 22), { width: 96, align: 'right', lineBreak: false });
    }
    doc.fillColor(INK);
    ctx.y = y + h;
  }

  private divisionColor(division?: string): string {
    switch (division) {
      case 'Division I':   return '#16803C';
      case 'Division II':  return '#1F5FA8';
      case 'Division III': return '#B7791F';
      case 'Division IV':  return '#C2410C';
      default:             return '#5B6B86';
    }
  }

  // ─── Holistic, attendance, comments ────────────────────────────────────────

  private renderHolistic(ctx: Ctx) {
    const { doc, input } = ctx;
    const fields = this.holisticFields(input);
    if (!fields.length) return;

    const rows = Math.ceil(fields.length / 3);
    const rowH = ctx.u.compact ? 32 : 36;
    const boxH = ctx.u.compact ? 27 : 30;
    this.ensureSpace(ctx, LABEL_H + rows * rowH);
    this.renderLabel(ctx, 'HOLISTIC ASSESSMENT');

    const gap = 8;
    const cw = (CW - gap * 2) / 3;
    fields.forEach(([label, value], i) => {
      const x = M + (i % 3) * (cw + gap);
      const y = ctx.y + Math.floor(i / 3) * rowH;
      doc.save().roundedRect(x, y, cw, boxH, 7).fill(PANEL).restore();
      doc.save().roundedRect(x, y, cw, boxH, 7).lineWidth(0.9).strokeColor(BORDER).stroke().restore();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED)
        .text(label.toUpperCase(), x + 10, y + 5, { characterSpacing: 0.5, lineBreak: false });
      const t = this.fitText(doc, value, 'Helvetica-Bold', 10.5, cw - 20, 7);
      doc.font('Helvetica-Bold').fontSize(t.size).fillColor(NAVY).text(t.text, x + 10, y + 16, { lineBreak: false });
    });
    doc.fillColor(INK);
    ctx.y += rows * rowH + 6;
  }

  private renderAttendance(ctx: Ctx) {
    const { doc, input } = ctx;
    const att = input.attendance;
    if (!att) return;

    const warnH = att.belowThreshold ? 16 : 0;
    this.ensureSpace(ctx, LABEL_H + 34 + warnH);
    this.renderLabel(ctx, 'ATTENDANCE');

    const y = ctx.y;
    doc.save().roundedRect(M, y, CW, 30, 8).fill(PANEL).restore();
    doc.save().roundedRect(M, y, CW, 30, 8).lineWidth(0.9).strokeColor(BORDER).stroke().restore();
    const items: Array<[string, string]> = [
      ['TOTAL DAYS', String(att.total)],
      ['PRESENT', String(att.present)],
      ['ABSENT', String(att.absent)],
      ['LATE', String(att.late)],
      ['RATE', `${att.attendanceRate.toFixed(1)}%`],
    ];
    const w = CW / items.length;
    items.forEach(([label, value], i) => {
      const x = M + i * w;
      if (i > 0) doc.save().moveTo(x, y + 6).lineTo(x, y + 24).lineWidth(0.7).strokeColor(BORDER).stroke().restore();
      doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
        .text(label, x, y + 5, { width: w, align: 'center', characterSpacing: 0.5, lineBreak: false });
      doc.font('Times-Bold').fontSize(12).fillColor(NAVY)
        .text(value, x, y + 14, { width: w, align: 'center', lineBreak: false });
    });
    ctx.y = y + 34;
    if (att.belowThreshold) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#B42318')
        .text('Attendance below 80% threshold — intervention may be required.', M, ctx.y + 2, { width: CW, lineBreak: false });
      ctx.y += 16;
    }
    doc.fillColor(INK);
    ctx.y += BLOCK_GAP;
  }

  private renderComments(ctx: Ctx) {
    const { doc, input } = ctx;
    this.ensureSpace(ctx, LABEL_H + ctx.u.comment);
    this.renderLabel(ctx, 'COMMENTS');

    const gap = 12;
    const bw = (CW - gap) / 2;
    const y = ctx.y;
    const compact = ctx.u.compact;
    const headH = compact ? 22 : 26;
    const boxes: Array<[string, string, string | null | undefined]> = [
      ['CLASS TEACHER', 'users', input.teacherComment],
      ['PRINCIPAL', 'cap', input.principalComment],
    ];

    boxes.forEach(([title, icon, comment], i) => {
      const x = M + i * (bw + gap);
      doc.save().roundedRect(x, y, bw, ctx.u.comment, 8).fill('white').restore();

      // Header bar clipped to the rounded box
      doc.save();
      doc.roundedRect(x, y, bw, ctx.u.comment, 8).clip();
      const grad = doc.linearGradient(x, y, x + bw, y);
      grad.stop(0, NAVY).stop(1, NAVY_MID);
      doc.rect(x, y, bw, headH).fill(grad);
      doc.restore();
      doc.save().roundedRect(x, y, bw, ctx.u.comment, 8).lineWidth(1).strokeColor(BORDER).stroke().restore();

      this.icon(doc, icon, x + 11, y + (headH - 16) / 2, 16, 'white', 1.6);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('white')
        .text(title, x + 34, y + (headH - 10.5) / 2 - 0.5, { characterSpacing: 0.5, lineBreak: false });

      const hasComment = !!(comment && comment.trim());
      doc.font(hasComment ? 'Helvetica' : 'Helvetica-Oblique').fontSize(9.5).fillColor(hasComment ? INK : MUTED)
        .text(hasComment ? (comment as string).trim() : 'No comment provided.', x + 12, y + headH + 7, {
          width: bw - 24, height: ctx.u.comment - headH - (compact ? 22 : 28), ellipsis: true,
        });

      // Blank line left for a handwritten signature
      const ly = y + ctx.u.comment - (compact ? 13 : 15);
      doc.save().moveTo(x + 12, ly).lineTo(x + bw * 0.62, ly).lineWidth(0.8).strokeColor(NAVY).stroke().restore();
      doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text('Signature & date', x + 12, ly + 2.5, { lineBreak: false });
    });
    doc.fillColor(INK);
    ctx.y = y + ctx.u.comment;
  }

  // ─── Drawing helpers ───────────────────────────────────────────────────────

  private icon(doc: Doc, name: string, x: number, y: number, size: number, color: string, lineWidth = 1.8) {
    const paths = ICONS[name];
    if (!paths) return;
    const s = size / 24;
    doc.save();
    doc.translate(x, y).scale(s);
    doc.lineWidth(lineWidth).lineCap('round').lineJoin('round').strokeColor(color);
    for (const d of paths) doc.path(d).stroke();
    doc.restore();
  }

  /**
   * Fits a value into a box: shrinks slightly on one line, then wraps up to `maxLines`
   * at a smaller size, and only truncates (with an ellipsis) as a last resort.
   */
  private fitLines(doc: Doc, text: string, font: string, size: number, maxW: number, maxLines: number, minSize: number) {
    doc.font(font);
    const singleLineMin = Math.max(minSize, size * 0.85);
    for (let s = size; s >= singleLineMin; s -= 0.25) {
      doc.fontSize(s);
      if (doc.widthOfString(text) <= maxW) return { text, size: s, lines: 1 };
    }
    // One wrapped line's height at the current size (PDFKit's line height includes the font's own gap).
    const lineHeight = () => doc.heightOfString('Mg', { width: 10000, lineGap: -1 });
    const fits = (t: string, s: number) => {
      doc.fontSize(s);
      return doc.heightOfString(t, { width: maxW, lineGap: -1 }) <= lineHeight() * maxLines + 0.5;
    };
    for (let s = Math.min(size, 10.5); s >= minSize; s -= 0.25) {
      if (fits(text, s)) {
        doc.fontSize(s);
        const lines = doc.heightOfString(text, { width: maxW, lineGap: -1 }) > lineHeight() * 1.5 ? 2 : 1;
        return { text, size: s, lines };
      }
    }
    let out = text;
    while (out.length > 1 && !fits(`${out}…`, minSize)) out = out.slice(0, -1);
    return { text: `${out.trimEnd()}…`, size: minSize, lines: maxLines };
  }

  /** Shrinks the font (then truncates with an ellipsis) until the text fits `maxW`. */
  private fitText(doc: Doc, text: string, font: string, size: number, maxW: number, minSize: number) {
    let s = size;
    doc.font(font).fontSize(s);
    while (s > minSize && doc.widthOfString(text) > maxW) {
      s -= 0.25;
      doc.fontSize(s);
    }
    let out = text;
    if (doc.widthOfString(out) > maxW) {
      while (out.length > 1 && doc.widthOfString(`${out}…`) > maxW) out = out.slice(0, -1);
      out = `${out.trimEnd()}…`;
    }
    return { text: out, size: s };
  }

  /** Single-line text centred vertically inside a cell. */
  private cellText(
    doc: Doc,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    font: string,
    size: number,
    color: string,
    align: 'left' | 'center',
  ) {
    const padX = 8;
    const t = this.fitText(doc, text, font, size, w - padX * 2, 6.5);
    doc.font(font).fontSize(t.size).fillColor(color);
    doc.text(t.text, x + padX, y + (h - doc.currentLineHeight()) / 2 + 0.3, {
      width: w - padX * 2,
      align,
      lineBreak: false,
    });
  }
}
