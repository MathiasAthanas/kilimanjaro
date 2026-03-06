import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportCardPdfService {
  constructor(private readonly configService: ConfigService) {}

  async generatePdf(input: {
    studentId: string;
    termId: string;
    academicYearId: string;
    studentName: string;
    registrationNumber: string;
    className: string;
    generatedAt: Date;
    results: Array<{
      subjectName: string;
      CAT1?: number;
      CAT2?: number;
      MIDTERM?: number;
      FINAL?: number;
      total: number;
      grade: string;
      remark: string;
    }>;
    average: number;
    overallGrade: string;
    rank?: number | null;
    totalStudents?: number | null;
    teacherComment?: string | null;
    principalComment?: string | null;
    internalPerformanceNote?: string;
    attendance?: {
      total: number;
      present: number;
      absent: number;
      late: number;
      attendanceRate: number;
      belowThreshold: boolean;
    };
    pairingStatus?: string;
  }): Promise<string> {
    const storageRoot = this.configService.get<string>('PDF_STORAGE_PATH', './storage/report-cards');
    const fileName = `report_${input.studentId}_${input.termId}.pdf`;
    const filePath = join(storageRoot, fileName);

    mkdirSync(dirname(filePath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(20).text('KILIMANJARO SCHOOLS', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text('ACADEMIC REPORT CARD', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Term ${input.termId} - ${input.academicYearId}`, { align: 'center' });

      doc.moveDown();
      doc.fontSize(11).text(`Student: ${input.studentName}`);
      doc.text(`Registration Number: ${input.registrationNumber}`);
      doc.text(`Class: ${input.className}`);
      doc.text(`Generated: ${input.generatedAt.toISOString()}`);

      doc.moveDown();
      doc.fontSize(11).text('Subject Results', { underline: true });
      doc.moveDown(0.5);

      for (const row of input.results) {
        doc.text(
          `${row.subjectName} | CAT1 ${row.CAT1 ?? 0} | CAT2 ${row.CAT2 ?? 0} | Mid ${row.MIDTERM ?? 0} | Final ${row.FINAL ?? 0} | Total ${row.total.toFixed(2)} | ${row.grade} (${row.remark})`,
        );
      }

      doc.moveDown();
      doc.text(`Overall Average: ${input.average.toFixed(2)}`);
      doc.text(`Overall Grade: ${input.overallGrade}`);
      if (input.rank) {
        doc.text(`Position ${input.rank} out of ${input.totalStudents ?? '-'}`);
      }

      doc.moveDown();
      if (input.attendance) {
        doc.text(
          `Attendance: Total ${input.attendance.total} | Present ${input.attendance.present} | Absent ${input.attendance.absent} | Late ${input.attendance.late} | Rate ${input.attendance.attendanceRate.toFixed(2)}%`,
        );
        if (input.attendance.belowThreshold) {
          doc.text('Attendance Alert: Below 80% threshold');
        }
      }

      if (input.pairingStatus) {
        doc.text(`Pairing Status: ${input.pairingStatus}`);
      }

      doc.moveDown();
      doc.text(`Class Teacher Comment: ${input.teacherComment || 'No comment provided'}`);
      doc.text(`Principal Comment: ${input.principalComment || 'No comment provided'}`);

      if (input.internalPerformanceNote) {
        doc.moveDown();
        doc.fontSize(10).text(`Internal Performance Note: ${input.internalPerformanceNote}`);
      }

      doc.moveDown();
      doc.fontSize(9).text('This is an official academic document of Kilimanjaro Schools');

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', (error) => reject(error));
    });

    return fileName;
  }
}
