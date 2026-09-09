import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
// pdfkit publishes a CommonJS constructor; require avoids default interop pitfalls.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const COLORS = {
  navy: '#061f33',
  blue: '#1c9fd1',
  gold: '#f4b740',
  slate: '#475569',
  muted: '#64748b',
  line: '#dbe4ee',
  paper: '#f6f9fc',
  emerald: '#059669',
  rose: '#dc2626',
  amber: '#d97706',
  indigo: '#4338CA',
  indigoLight: '#eef2ff',
  tableAlt: '#f0f9ff',
};

const PAGE = { width: 595.28, height: 841.89, margin: 44 };
const contentWidth = PAGE.width - PAGE.margin * 2;

function logoPath() {
  return path.resolve(process.cwd(), '../../../dashboard/public/kilimanjaro_logo.png');
}

function gradeTone(grade: string): string {
  const g = (grade || '').toUpperCase();
  if (['A', 'A+', 'A-'].includes(g)) return COLORS.emerald;
  if (['B', 'B+', 'B-', 'C', 'C+'].includes(g)) return COLORS.blue;
  if (['D', 'D+'].includes(g)) return COLORS.amber;
  return COLORS.rose;
}

interface ReportCardData {
  student: { fullName: string; registrationNumber: string; gender: string };
  class: { name: string; level: number; stageLabel: string };
  term: { name: string };
  academicYear: { name: string } | null;
  summary: {
    overallAverage: number;
    overallGrade: string;
    overallPoints: number;
    overallRemark: string;
    rank: number | null;
    totalStudentsInClass: number | null;
    subjectCount: number;
    failingSubjectCount: number;
    divisionSummary: unknown;
    isPublished: boolean;
    generatedAt: Date;
  };
  remarks: { teacherComment: string | null; principalComment: string | null };
  holistic: {
    behaviourGrade: string | null;
    socialSkillsGrade: string | null;
    extraCurricularNote: string | null;
    readingAbility: string | null;
    writingAbility: string | null;
    numeracyAbility: string | null;
  };
  subjects: Array<{
    subjectName: string;
    score: number;
    grade: string;
    gradePoints: number;
    isPassing: boolean;
    rank: number | null;
  }>;
  attendance: { present: number; absent: number; late: number; excused: number; totalDays: number; rate: number | null };
}

/**
 * Branded student report card, mirroring the layout and polish of the mobile
 * app's report-card view: school header, term title bar, identity +
 * performance panels, per-subject results table, remarks and signatures.
 */
@Injectable()
export class ReportCardGenerator {
  async generate(filePath: string, data: ReportCardData) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, autoFirstPage: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    this.header(doc);
    this.titleBar(doc, data);
    this.identityAndPerformance(doc, data);
    this.divisionBox(doc, data);
    this.subjectTable(doc, data);
    this.attendanceRow(doc, data);
    this.holisticBox(doc, data);
    this.remarkBox(doc, "Class Teacher's Remarks", data.remarks.teacherComment);
    this.remarkBox(doc, "Principal's Remarks", data.remarks.principalComment);
    this.signatureRow(doc);
    this.footer(doc, data);

    doc.end();
    await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
  }

  private header(doc: any) {
    doc.rect(0, 0, PAGE.width, 112).fill(COLORS.navy);
    doc.rect(0, 100, PAGE.width, 12).fill(COLORS.gold);

    const lp = logoPath();
    if (fs.existsSync(lp)) {
      doc.image(lp, PAGE.margin, 20, { width: 64, height: 64 });
    } else {
      doc.circle(PAGE.margin + 32, 52, 32).fill(COLORS.blue);
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#ffffff')
      .text('KILIMANJARO SCHOOLS', 124, 28)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#dbeafe')
      .text('P.O. Box 1885, Moshi, Kilimanjaro — Tanzania', 124, 54)
      .text('academics@kilimanjaroschools.sc.tz | +255 27 275 0000', 124, 67)
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.gold)
      .text('STUDENT ACADEMIC REPORT CARD', 124, 82, { characterSpacing: 1.1 });

    doc.y = 128;
  }

  private titleBar(doc: any, data: ReportCardData) {
    const y = doc.y;
    const yearLabel = data.academicYear?.name || '';
    doc.roundedRect(PAGE.margin, y, contentWidth, 34, 8).fill(COLORS.indigoLight);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLORS.indigo)
      .text(`${data.term.name} — ${yearLabel}`, PAGE.margin + 14, y + 10, { width: contentWidth - 200 })
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.slate)
      .text(`${data.class.stageLabel}${data.summary.isPublished ? '  |  PUBLISHED' : '  |  PROVISIONAL'}`, PAGE.margin + 14, y + 11, {
        width: contentWidth - 28,
        align: 'right',
      });
    doc.y = y + 46;
  }

  private identityAndPerformance(doc: any, data: ReportCardData) {
    const y = doc.y;
    const half = (contentWidth - 12) / 2;

    // Identity panel
    doc.roundedRect(PAGE.margin, y, half, 108, 10).fillAndStroke('#ffffff', COLORS.line);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('STUDENT', PAGE.margin + 14, y + 12);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.navy).text(data.student.fullName, PAGE.margin + 14, y + 26, { width: half - 28 });
    const idRows: Array<[string, string]> = [
      ['Registration No.', data.student.registrationNumber],
      ['Class', data.class.name],
      ['Gender', data.student.gender === 'MALE' ? 'Male' : 'Female'],
    ];
    let rowY = y + 48;
    for (const [label, value] of idRows) {
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.slate).text(label, PAGE.margin + 14, rowY);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.navy).text(value, PAGE.margin + 110, rowY, { width: half - 124 });
      rowY += 18;
    }

    // Performance panel
    const px = PAGE.margin + half + 12;
    doc.roundedRect(px, y, half, 108, 10).fillAndStroke(COLORS.paper, COLORS.line);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('OVERALL PERFORMANCE', px + 14, y + 12);
    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor(gradeTone(data.summary.overallGrade))
      .text(`${data.summary.overallAverage.toFixed(1)}%`, px + 14, y + 28);
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(COLORS.navy)
      .text(`Grade ${data.summary.overallGrade}`, px + 130, y + 34, { width: half - 144 });
    const rankText =
      data.summary.rank && data.summary.totalStudentsInClass
        ? `Position ${data.summary.rank} of ${data.summary.totalStudentsInClass}`
        : 'Position pending';
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.slate)
      .text(rankText, px + 14, y + 66)
      .text(`${data.summary.subjectCount} subjects | ${data.summary.failingSubjectCount} below pass mark`, px + 14, y + 80, {
        width: half - 28,
      });

    doc.y = y + 122;
  }

  private divisionBox(doc: any, data: ReportCardData) {
    const division = data.summary.divisionSummary as { division?: string; points?: number } | null;
    const label = division?.division
      ? `Division ${division.division}${division.points != null ? ` — ${division.points} points` : ''}`
      : data.summary.overallRemark;
    if (!label) return;
    const y = doc.y;
    doc.roundedRect(PAGE.margin, y, contentWidth, 30, 8).fill('#fdf8ed');
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#92610f')
      .text(label, PAGE.margin + 14, y + 10, { width: contentWidth - 28 });
    doc.y = y + 42;
  }

  private ensureSpace(doc: any, needed: number) {
    if (doc.y + needed > PAGE.height - 70) doc.addPage();
  }

  private subjectTable(doc: any, data: ReportCardData) {
    this.ensureSpace(doc, 90);
    const y0 = doc.y;
    const cols = [
      { label: 'SUBJECT', width: contentWidth * 0.4, align: 'left' as const },
      { label: 'SCORE %', width: contentWidth * 0.15, align: 'right' as const },
      { label: 'GRADE', width: contentWidth * 0.13, align: 'center' as const },
      { label: 'POINTS', width: contentWidth * 0.13, align: 'right' as const },
      { label: 'RANK', width: contentWidth * 0.19, align: 'right' as const },
    ];

    doc.roundedRect(PAGE.margin, y0, contentWidth, 26, 6).fill(COLORS.navy);
    let x = PAGE.margin + 12;
    for (const col of cols) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gold).text(col.label, x, y0 + 9, {
        width: col.width - 16,
        align: col.align,
      });
      x += col.width;
    }
    doc.y = y0 + 26;

    if (!data.subjects.length) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text('No published subject results for this term yet.', PAGE.margin + 12, doc.y + 10);
      doc.y += 40;
      return;
    }

    data.subjects.forEach((subject, index) => {
      this.ensureSpace(doc, 24);
      const y = doc.y;
      if (index % 2 === 1) doc.rect(PAGE.margin, y, contentWidth, 22).fill(COLORS.tableAlt);
      let cx = PAGE.margin + 12;
      const rankLabel = subject.rank ? `${subject.rank}` : '-';
      const cells = [
        subject.subjectName,
        subject.score.toFixed(1),
        subject.grade,
        subject.gradePoints.toFixed(1),
        rankLabel,
      ];
      cells.forEach((cell, i) => {
        const col = cols[i];
        const color = i === 2 ? gradeTone(subject.grade) : i === 0 ? COLORS.navy : COLORS.slate;
        doc
          .font(i === 0 || i === 2 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor(subject.isPassing || i === 0 ? color : COLORS.rose)
          .text(cell, cx, y + 6, { width: col.width - 16, align: col.align });
        cx += col.width;
      });
      doc
        .moveTo(PAGE.margin, y + 22)
        .lineTo(PAGE.width - PAGE.margin, y + 22)
        .lineWidth(0.35)
        .strokeColor(COLORS.line)
        .stroke();
      doc.y = y + 22;
    });
    doc.y += 14;
  }

  private attendanceRow(doc: any, data: ReportCardData) {
    if (!data.attendance.totalDays) return;
    this.ensureSpace(doc, 66);
    const y = doc.y;
    const cards: Array<[string, string, string]> = [
      ['ATTENDANCE RATE', data.attendance.rate != null ? `${data.attendance.rate}%` : '-', COLORS.emerald],
      ['DAYS PRESENT', String(data.attendance.present), COLORS.blue],
      ['DAYS ABSENT', String(data.attendance.absent), data.attendance.absent > 5 ? COLORS.rose : COLORS.slate],
      ['LATE / EXCUSED', `${data.attendance.late} / ${data.attendance.excused}`, COLORS.amber],
    ];
    const gap = 10;
    const w = (contentWidth - gap * 3) / 4;
    cards.forEach(([label, value, tone], i) => {
      const x = PAGE.margin + i * (w + gap);
      doc.roundedRect(x, y, w, 52, 8).fillAndStroke('#ffffff', COLORS.line);
      doc.rect(x, y, 4, 52).fill(tone);
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(label, x + 12, y + 10, { width: w - 20 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.navy).text(value, x + 12, y + 26, { width: w - 20 });
    });
    doc.y = y + 66;
  }

  private holisticBox(doc: any, data: ReportCardData) {
    const rows: Array<[string, string]> = [];
    if (data.holistic.behaviourGrade) rows.push(['Behaviour', data.holistic.behaviourGrade]);
    if (data.holistic.socialSkillsGrade) rows.push(['Social Skills', data.holistic.socialSkillsGrade]);
    if (data.holistic.readingAbility) rows.push(['Reading', data.holistic.readingAbility]);
    if (data.holistic.writingAbility) rows.push(['Writing', data.holistic.writingAbility]);
    if (data.holistic.numeracyAbility) rows.push(['Numeracy', data.holistic.numeracyAbility]);
    if (!rows.length) return;

    this.ensureSpace(doc, 60 + rows.length * 4);
    const y = doc.y;
    const boxH = 34 + Math.ceil(rows.length / 3) * 20 + (data.holistic.extraCurricularNote ? 20 : 0);
    doc.roundedRect(PAGE.margin, y, contentWidth, boxH, 8).fillAndStroke(COLORS.paper, COLORS.line);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('HOLISTIC DEVELOPMENT', PAGE.margin + 14, y + 10);
    const colW = (contentWidth - 28) / 3;
    rows.forEach(([label, value], i) => {
      const cx = PAGE.margin + 14 + (i % 3) * colW;
      const cy = y + 26 + Math.floor(i / 3) * 20;
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.slate).text(`${label}:`, cx, cy, { continued: true });
      doc.font('Helvetica-Bold').fillColor(COLORS.navy).text(` ${value}`);
    });
    if (data.holistic.extraCurricularNote) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLORS.slate)
        .text(`Extra-curricular: ${data.holistic.extraCurricularNote}`, PAGE.margin + 14, y + boxH - 18, {
          width: contentWidth - 28,
        });
    }
    doc.y = y + boxH + 12;
  }

  private remarkBox(doc: any, title: string, message: string | null) {
    this.ensureSpace(doc, 72);
    const y = doc.y;
    const text = message?.trim() || 'No remarks recorded for this term.';
    const textHeight = doc.heightOfString(text, { width: contentWidth - 28 });
    const boxH = Math.max(30 + textHeight + 12, 56);
    doc.roundedRect(PAGE.margin, y, contentWidth, boxH, 8).fillAndStroke('#ffffff', COLORS.line);
    doc.rect(PAGE.margin, y, 4, boxH).fill(COLORS.gold);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted).text(title.toUpperCase(), PAGE.margin + 16, y + 10);
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(message?.trim() ? COLORS.navy : COLORS.muted)
      .text(text, PAGE.margin + 16, y + 26, { width: contentWidth - 28, lineGap: 1.5 });
    doc.y = y + boxH + 10;
  }

  private signatureRow(doc: any) {
    this.ensureSpace(doc, 76);
    const y = doc.y + 16;
    const w = (contentWidth - 40) / 3;
    const labels = ['Class Teacher', 'Principal', 'Parent / Guardian'];
    labels.forEach((label, i) => {
      const x = PAGE.margin + i * (w + 20);
      doc
        .moveTo(x, y + 26)
        .lineTo(x + w, y + 26)
        .lineWidth(0.8)
        .strokeColor(COLORS.slate)
        .stroke();
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(`${label} — Signature & Date`, x, y + 32, {
        width: w,
        align: 'center',
      });
    });
    doc.y = y + 52;
  }

  private footer(doc: any, data: ReportCardData) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .save()
        .moveTo(PAGE.margin, PAGE.height - 44)
        .lineTo(PAGE.width - PAGE.margin, PAGE.height - 44)
        .lineWidth(0.6)
        .strokeColor(COLORS.line)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
          `Kilimanjaro Schools | Official report card — ${data.student.registrationNumber}`,
          PAGE.margin,
          PAGE.height - 34,
          { width: 300 },
        )
        .text(
          `Generated ${new Date().toLocaleDateString('en-GB', { dateStyle: 'medium' })} | Page ${i + 1} of ${pages.count}`,
          PAGE.width - PAGE.margin - 240,
          PAGE.height - 34,
          { width: 240, align: 'right' },
        )
        .restore();
    }
  }
}
