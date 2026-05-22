import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import PDFDocument from 'pdfkit';

const BRAND = '#4338CA';
const BRAND_LIGHT = '#EEF2FF';

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
  generatedAt: Date;
  results: PdfResult[];
  average: number;
  overallGrade: string;
  reportTemplateCode?: string;
  divisionSummary?: unknown;
  rank?: number | null;
  totalStudents?: number | null;
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

@Injectable()
export class ReportCardPdfService {
  constructor(private readonly configService: ConfigService) {}

  async generatePdf(input: ReportCardPdfInput): Promise<string> {
    const storageRoot = this.configService.get<string>('PDF_STORAGE_PATH', './storage/report-cards');
    const fileName = `report_${input.studentId}_${input.termId}.pdf`;
    const filePath = join(storageRoot, fileName);
    mkdirSync(dirname(filePath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      const template = input.reportTemplateCode ?? 'O_LEVEL_TERM';

      this.renderHeader(doc, input);

      if (template === 'PRIMARY_STANDARD') {
        this.renderPrimaryBody(doc, input);
      } else if (template === 'O_LEVEL_NATIONAL_READY') {
        this.renderOLevelNationalBody(doc, input);
      } else if (template === 'A_LEVEL_NATIONAL_READY' || template === 'A_LEVEL_COMBINATION') {
        this.renderALevelBody(doc, input);
      } else {
        // O_LEVEL_TERM (default)
        this.renderOLevelTermBody(doc, input);
      }

      this.renderFooter(doc, input);
      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    });

    return fileName;
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  private renderHeader(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const { width } = doc.page;
    const margin = 48;
    const contentWidth = width - margin * 2;

    // Top banner
    doc.rect(margin, margin, contentWidth, 70).fill(BRAND);

    doc.fillColor('white')
      .fontSize(18).font('Helvetica-Bold')
      .text('KILIMANJARO SCHOOLS', margin, margin + 12, { width: contentWidth, align: 'center' });
    doc.fontSize(11).font('Helvetica')
      .text('ACADEMIC REPORT CARD', margin, margin + 35, { width: contentWidth, align: 'center' });

    const stageLabel = this.stageLabelFor(input.reportTemplateCode);
    doc.fontSize(9)
      .text(stageLabel, margin, margin + 52, { width: contentWidth, align: 'center' });

    doc.fillColor('#1e293b');
    doc.moveDown(4.2);

    // Student info box
    const infoTop = doc.y;
    doc.rect(margin, infoTop, contentWidth, 58).fill('#F8FAFC').stroke('#E2E8F0');
    doc.fillColor('#1e293b');

    const col = contentWidth / 3;
    this.infoField(doc, 'Student', input.studentName,       margin + 8,       infoTop + 6, col - 8);
    this.infoField(doc, 'Reg. No.', input.registrationNumber, margin + col + 4, infoTop + 6, col - 8);
    this.infoField(doc, 'Class',   input.className,          margin + col * 2 + 4, infoTop + 6, col - 8);

    const termLabel = `Term ID: ${input.termId.slice(-8)}`;
    const dateLabel = `Year: ${input.academicYearId.slice(-8)}`;
    this.infoField(doc, 'Term',    termLabel,  margin + 8,       infoTop + 32, col - 8);
    this.infoField(doc, 'Year',    dateLabel,  margin + col + 4, infoTop + 32, col - 8);

    if (input.rank) {
      this.infoField(doc, 'Position', `${input.rank} / ${input.totalStudents ?? '-'}`, margin + col * 2 + 4, infoTop + 32, col - 8);
    }

    doc.y = infoTop + 68;
    doc.moveDown(0.5);
  }

  private stageLabelFor(template?: string): string {
    switch (template) {
      case 'PRIMARY_STANDARD':        return 'Primary School Report';
      case 'O_LEVEL_TERM':            return 'Secondary School (O-Level) Termly Report';
      case 'O_LEVEL_NATIONAL_READY':  return 'Form Four (CSEE Readiness) Report';
      case 'A_LEVEL_COMBINATION':     return 'Advanced Level (A-Level) Termly Report';
      case 'A_LEVEL_NATIONAL_READY':  return 'Form Six (ACSEE Readiness) Report';
      default:                         return 'Academic Report';
    }
  }

  private infoField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, w: number) {
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6B7280')
      .text(label.toUpperCase(), x, y, { width: w, lineBreak: false });
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827')
      .text(value, x, y + 11, { width: w, lineBreak: false });
  }

  // ─── Primary layout ────────────────────────────────────────────────────────

  private renderPrimaryBody(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const ds = input.divisionSummary as DivisionSummary | undefined;

    this.renderSectionTitle(doc, 'Subject Performance');
    this.renderSubjectTable(doc, input.results, ['Subject', 'CAT1', 'CAT2', 'Total', 'Grade', 'Remark']);

    // Promotable verdict
    const verdict = ds?.descriptor ?? (input.average >= 50 ? 'Promotable' : 'Needs intervention');
    const verdictTone = verdict.includes('Promotable') ? '#16A34A' : '#DC2626';
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;

    doc.moveDown(0.8);
    doc.rect(margin, doc.y, contentWidth, 32).fill(verdictTone);
    doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
      .text(verdict, margin, doc.y + 9, { width: contentWidth, align: 'center' });
    doc.fillColor('#1e293b');
    doc.y += 40;
    doc.moveDown(0.8);

    // Overall
    this.renderOverallStrip(doc, input);

    // Holistic assessment
    const hasHolistic = input.behaviourGrade || input.readingAbility || input.writingAbility || input.numeracyAbility;
    if (hasHolistic) {
      doc.moveDown(0.8);
      this.renderSectionTitle(doc, 'Holistic Assessment');
      const fields: [string, string | null | undefined][] = [
        ['Behaviour',      input.behaviourGrade],
        ['Social Skills',  input.socialSkillsGrade],
        ['Reading',        input.readingAbility],
        ['Writing',        input.writingAbility],
        ['Numeracy',       input.numeracyAbility],
        ['Extra-Curricular', input.extraCurricularNote],
      ];
      const cols = 3;
      const cw = (doc.page.width - 48 * 2) / cols;
      let colIdx = 0;
      let rowY = doc.y;
      for (const [label, value] of fields) {
        if (!value) { colIdx++; if (colIdx >= cols) { colIdx = 0; rowY += 36; } continue; }
        const x = 48 + colIdx * cw;
        doc.rect(x, rowY, cw - 6, 30).fill('#F8FAFC').stroke('#E2E8F0');
        doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold').text(label.toUpperCase(), x + 6, rowY + 5, { width: cw - 12 });
        doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(value, x + 6, rowY + 16, { width: cw - 12 });
        colIdx++;
        if (colIdx >= cols) { colIdx = 0; rowY += 36; }
      }
      doc.y = rowY + 40;
    }

    this.renderAttendance(doc, input.attendance);
    this.renderComments(doc, input);
  }

  // ─── O-Level term layout ───────────────────────────────────────────────────

  private renderOLevelTermBody(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    this.renderSectionTitle(doc, 'Subject Results');
    this.renderSubjectTable(doc, input.results, ['Subject', 'CAT1', 'CAT2', 'Midterm', 'Final', 'Total', 'Grade', 'Remark']);
    this.renderOverallStrip(doc, input);
    this.renderAttendance(doc, input.attendance);
    this.renderComments(doc, input);
  }

  // ─── O-Level national-ready layout ────────────────────────────────────────

  private renderOLevelNationalBody(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const ds = input.divisionSummary as DivisionSummary | undefined;

    this.renderSectionTitle(doc, 'CSEE Readiness — Subject Results (NECTA Grading)');
    this.renderSubjectTable(doc, input.results, ['Subject', 'CAT1', 'CAT2', 'Midterm', 'Final', 'Total', 'Grade', 'Grade Pts', 'Remark'], true);

    // Division box
    if (ds?.division) {
      doc.moveDown(0.8);
      this.renderDivisionBox(doc, ds, 'O_LEVEL');
    }

    this.renderOverallStrip(doc, input);
    this.renderAttendance(doc, input.attendance);
    this.renderComments(doc, input);
  }

  // ─── A-Level layout ────────────────────────────────────────────────────────

  private renderALevelBody(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const ds = input.divisionSummary as DivisionSummary | undefined;
    const isNational = input.reportTemplateCode === 'A_LEVEL_NATIONAL_READY';

    const principal = input.results.filter((r) => r.subjectRole === 'PRINCIPAL' || !r.subjectRole);
    const subsidiary = input.results.filter((r) => r.subjectRole === 'SUBSIDIARY' || r.subjectRole === 'COMPULSORY_SUBSIDIARY');

    if (principal.length > 0) {
      this.renderSectionTitle(doc, 'Principal Subjects');
      this.renderSubjectTable(doc, principal, ['Subject', 'CAT1', 'Midterm', 'Final', 'Total', 'Grade', 'Grade Pts', 'Remark'], isNational);
    }

    if (subsidiary.length > 0) {
      doc.moveDown(0.4);
      this.renderSectionTitle(doc, 'Subsidiary / General Studies');
      this.renderSubjectTable(doc, subsidiary, ['Subject', 'CAT1', 'Midterm', 'Final', 'Total', 'Grade', 'Remark'], false);
    }

    if (isNational && ds?.division) {
      doc.moveDown(0.8);
      this.renderDivisionBox(doc, ds, 'A_LEVEL');
    }

    this.renderOverallStrip(doc, input);
    this.renderAttendance(doc, input.attendance);
    this.renderComments(doc, input);
  }

  // ─── Shared render helpers ─────────────────────────────────────────────────

  private renderSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#6B7280')
      .text(title.toUpperCase(), { characterSpacing: 0.6 });
    doc.moveDown(0.3);
    doc.moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke('#E2E8F0');
    doc.moveDown(0.4);
  }

  private renderSubjectTable(
    doc: PDFKit.PDFDocument,
    rows: PdfResult[],
    headers: string[],
    showGradePoints = false,
  ) {
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;

    // Column widths heuristic
    const colCount = headers.length;
    const subjectColW = contentWidth * 0.28;
    const remainW = contentWidth - subjectColW;
    const numColW = remainW / (colCount - 1);

    const colWidths = headers.map((h, i) =>
      i === 0 ? subjectColW : (h === 'Remark' ? numColW * 1.6 : numColW),
    );
    // Normalise so total fits
    const totalW = colWidths.reduce((s, w) => s + w, 0);
    const scale = contentWidth / totalW;
    const cw = colWidths.map((w) => w * scale);

    const rowH = 18;
    const headerY = doc.y;

    // Header row
    doc.rect(margin, headerY, contentWidth, rowH).fill(BRAND);
    let cx = margin;
    for (let i = 0; i < headers.length; i++) {
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text(headers[i], cx + 4, headerY + 5, { width: cw[i] - 4, align: i === 0 ? 'left' : 'center', lineBreak: false });
      cx += cw[i];
    }

    doc.fillColor('#1e293b');
    let y = headerY + rowH;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const bg = idx % 2 === 0 ? 'white' : '#F8FAFC';
      doc.rect(margin, y, contentWidth, rowH).fill(bg);

      const isFailing = !this.isPassingGrade(row.grade);
      const textColor = isFailing ? '#DC2626' : '#111827';

      cx = margin;
      const values = this.rowValues(row, headers, showGradePoints);
      for (let i = 0; i < values.length; i++) {
        doc.fillColor(i === 0 ? '#111827' : textColor)
          .fontSize(8).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .text(values[i], cx + 4, y + 5, { width: cw[i] - 4, align: i === 0 ? 'left' : 'center', lineBreak: false });
        cx += cw[i];
      }

      y += rowH;
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 48;
      }
    }

    // Bottom border
    doc.rect(margin, y, contentWidth, 1).fill('#E2E8F0');
    doc.y = y + 8;
    doc.moveDown(0.3);
  }

  private rowValues(row: PdfResult, headers: string[], showGradePoints: boolean): string[] {
    return headers.map((h) => {
      switch (h) {
        case 'Subject':     return row.subjectName;
        case 'CAT1':        return row.CAT1 != null ? row.CAT1.toFixed(1) : '-';
        case 'CAT2':        return row.CAT2 != null ? row.CAT2.toFixed(1) : '-';
        case 'Midterm':     return row.MIDTERM != null ? row.MIDTERM.toFixed(1) : '-';
        case 'Final':       return row.FINAL != null ? row.FINAL.toFixed(1) : '-';
        case 'Total':       return row.total.toFixed(1);
        case 'Grade':       return row.grade;
        case 'Grade Pts':   return showGradePoints ? String((row as any).gradePoints ?? '-') : '-';
        case 'Remark':      return row.remark;
        default:            return '-';
      }
    });
  }

  private isPassingGrade(grade: string): boolean {
    return !['F', 'E', 'S'].includes(grade.toUpperCase());
  }

  private renderDivisionBox(doc: PDFKit.PDFDocument, ds: DivisionSummary, mode: 'O_LEVEL' | 'A_LEVEL') {
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;
    const boxH = 56;

    const divColor = this.divisionColor(ds.division);
    doc.rect(margin, doc.y, contentWidth, boxH).fill(divColor);

    const titleLabel = mode === 'A_LEVEL' ? 'ACSEE Division Projection' : 'CSEE Division Projection';
    doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold')
      .text(titleLabel, margin + 12, doc.y + 8, { width: contentWidth - 24 });

    doc.fontSize(22).font('Helvetica-Bold')
      .text(ds.division ?? 'Ungraded', margin + 12, doc.y + 16, { lineBreak: false });

    doc.fontSize(10)
      .text(ds.descriptor, margin + 120, doc.y + 16, { width: contentWidth - 140, lineBreak: false });

    doc.fillColor('#1e293b');
    doc.y += boxH + 8;
    doc.moveDown(0.2);
  }

  private divisionColor(division?: string): string {
    switch (division) {
      case 'Division I':   return '#16A34A';
      case 'Division II':  return '#2563EB';
      case 'Division III': return '#CA8A04';
      case 'Division IV':  return '#EA580C';
      default:             return '#6B7280';
    }
  }

  private renderOverallStrip(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;
    doc.moveDown(0.5);
    doc.rect(margin, doc.y, contentWidth, 28).fill(BRAND_LIGHT).stroke('#C7D2FE');
    doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold')
      .text(
        `Overall Average: ${input.average.toFixed(1)}%   Grade: ${input.overallGrade}`,
        margin + 10,
        doc.y + 9,
        { width: contentWidth - 20 },
      );
    doc.fillColor('#1e293b');
    doc.y += 36;
    doc.moveDown(0.4);
  }

  private renderAttendance(doc: PDFKit.PDFDocument, att?: AttendanceSummary) {
    if (!att) return;
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;
    doc.moveDown(0.4);
    this.renderSectionTitle(doc, 'Attendance');
    doc.fontSize(9).font('Helvetica').fillColor('#374151')
      .text(
        `Total: ${att.total}   Present: ${att.present}   Absent: ${att.absent}   Late: ${att.late}   Rate: ${att.attendanceRate.toFixed(1)}%`,
        48, doc.y, { width: contentWidth },
      );
    if (att.belowThreshold) {
      doc.moveDown(0.2);
      doc.fillColor('#DC2626').fontSize(8.5).font('Helvetica-Bold')
        .text('Attendance below 80% threshold — intervention may be required.', 48, doc.y, { width: contentWidth });
      doc.fillColor('#374151');
    }
    doc.moveDown(0.5);
  }

  private renderComments(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;
    doc.moveDown(0.4);
    this.renderSectionTitle(doc, 'Comments');

    const boxH = 46;
    const halfW = (contentWidth - 8) / 2;

    // Class Teacher
    doc.rect(margin, doc.y, halfW, boxH).fill('#F8FAFC').stroke('#E2E8F0');
    doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold')
      .text('CLASS TEACHER', margin + 6, doc.y + 5, { width: halfW - 12 });
    doc.fillColor('#111827').fontSize(9).font('Helvetica')
      .text(input.teacherComment || 'No comment provided.', margin + 6, doc.y + 17, { width: halfW - 12, height: boxH - 22 });

    // Principal
    const px = margin + halfW + 8;
    doc.rect(px, doc.y, halfW, boxH).fill('#F8FAFC').stroke('#E2E8F0');
    doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold')
      .text('PRINCIPAL', px + 6, doc.y + 5, { width: halfW - 12 });
    doc.fillColor('#111827').fontSize(9).font('Helvetica')
      .text(input.principalComment || 'No comment provided.', px + 6, doc.y + 17, { width: halfW - 12, height: boxH - 22 });

    doc.y += boxH + 6;
    doc.moveDown(0.3);
  }

  // ─── Footer ────────────────────────────────────────────────────────────────

  private renderFooter(doc: PDFKit.PDFDocument, input: ReportCardPdfInput) {
    const margin = 48;
    const contentWidth = doc.page.width - margin * 2;
    const footerY = doc.page.height - 48;

    doc.moveTo(margin, footerY).lineTo(margin + contentWidth, footerY).stroke('#E2E8F0');
    doc.fillColor('#9CA3AF').fontSize(7.5).font('Helvetica')
      .text(
        `Generated: ${input.generatedAt.toISOString().slice(0, 10)}   |   Kilimanjaro Schools — Official Academic Document   |   ${input.registrationNumber}`,
        margin, footerY + 6,
        { width: contentWidth, align: 'center' },
      );
  }
}
