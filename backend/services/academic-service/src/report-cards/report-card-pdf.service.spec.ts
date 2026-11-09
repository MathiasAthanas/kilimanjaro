import { ConfigService } from '@nestjs/config';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ReportCardPdfInput, ReportCardPdfService } from './report-card-pdf.service';

describe('ReportCardPdfService', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'report-card-pdf-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('keeps a representative Primary report and its footer on one page', async () => {
    const config = { get: jest.fn().mockReturnValue(directory) } as unknown as ConfigService;
    const service = new ReportCardPdfService(config);
    const subjects = [
      'Christian Religious Education',
      'Kiswahili',
      'Listening & Speaking',
      'English Writing',
      'English Reading',
      'Culture, Arts & Sports',
      'Health Care & Environment',
      'Arithmetic',
      'Islamic Religious Education',
    ];
    const input: ReportCardPdfInput = {
      studentId: 'student-1',
      termId: 'term-1',
      academicYearId: 'year-1',
      studentName: 'Test Student',
      registrationNumber: 'KEMS-P-TEST',
      className: 'Class 2 A',
      termName: 'Term 3',
      academicYearName: '2026',
      generatedAt: new Date('2026-11-09T00:00:00.000Z'),
      results: subjects.map((subjectName, index) => ({
        subjectName,
        total: index === subjects.length - 1 ? 0 : 80,
        grade: index === subjects.length - 1 ? 'EXEMPT' : 'A',
        remark: index === subjects.length - 1 ? 'Exempt' : 'Excellent',
        status: index === subjects.length - 1 ? 'EXEMPT' : 'SCORED',
      })),
      average: 80,
      overallGrade: 'A',
      subjectsAssessed: 8,
      subjectsExpected: 9,
      reportTemplateCode: 'PRIMARY_STANDARD',
      divisionSummary: { mode: 'PRIMARY', descriptor: 'Promotable', totalPoints: 0 },
      rank: 1,
      totalStudents: 42,
    };

    const fileName = await service.generatePdf(input);
    const pdf = readFileSync(join(directory, fileName), 'latin1');
    const pageObjects = pdf.match(/\/Type \/Page\b/g) ?? [];

    expect(pageObjects).toHaveLength(1);
    expect(pdf).toContain('/Count 1');
  });
});
