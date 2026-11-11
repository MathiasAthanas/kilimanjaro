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
      overallRank: 2,
      totalStudentsOverall: 81,
      examLabel: 'Annual Exam',
    };

    const fileName = await service.generatePdf(input);
    const pdf = readFileSync(join(directory, fileName), 'latin1');
    const pageObjects = pdf.match(/\/Type \/Page\b/g) ?? [];

    expect(pageObjects).toHaveLength(1);
    expect(pdf).toContain('/Count 1');
  });

  it('keeps holistic and attendance details off the printed report card', async () => {
    const config = { get: jest.fn().mockReturnValue(directory) } as unknown as ConfigService;
    const service = new ReportCardPdfService(config);
    const holistic = jest.spyOn(service as any, 'renderHolistic');
    const attendance = jest.spyOn(service as any, 'renderAttendance');

    await service.generatePdf({
      studentId: 'student-private-details',
      termId: 'term-1',
      academicYearId: 'year-1',
      studentName: 'Test Student',
      registrationNumber: 'KEMS-P-TEST',
      className: 'Class 2 A',
      generatedAt: new Date('2026-11-10T00:00:00.000Z'),
      results: [{ subjectName: 'Mathematics', total: 80, grade: 'A', remark: 'Excellent' }],
      average: 80,
      overallGrade: 'A',
      reportTemplateCode: 'PRIMARY_STANDARD',
      behaviourGrade: 'A',
      attendance: { total: 90, present: 87, absent: 2, late: 1, attendanceRate: 96.7, belowThreshold: false },
    });

    expect(holistic).not.toHaveBeenCalled();
    expect(attendance).not.toHaveBeenCalled();
  });

  const buildInput = (overrides: Partial<ReportCardPdfInput>): ReportCardPdfInput => ({
    studentId: 'student-2',
    termId: 'term-1',
    academicYearId: 'year-1',
    studentName: 'Test Student',
    registrationNumber: 'KSS-TEST',
    className: 'Form 4 A',
    termName: 'Term 1',
    academicYearName: '2026',
    generatedAt: new Date('2026-11-09T00:00:00.000Z'),
    results: [],
    average: 70,
    overallGrade: 'B',
    ...overrides,
  });

  const pageCount = (fileName: string) =>
    (readFileSync(join(directory, fileName), 'latin1').match(/\/Type \/Page\b/g) ?? []).length;

  it('paginates a long subject list instead of overflowing the page', async () => {
    const config = { get: jest.fn().mockReturnValue(directory) } as unknown as ConfigService;
    const service = new ReportCardPdfService(config);
    const results = Array.from({ length: 30 }, (_, i) => ({
      subjectName: `Subject ${i + 1}`,
      total: 60 + (i % 20),
      grade: 'B',
      remark: 'Good',
      status: 'SCORED',
    }));

    const fileName = await service.generatePdf(buildInput({ results, reportTemplateCode: 'O_LEVEL_TERM' }));

    expect(pageCount(fileName)).toBeGreaterThan(1);
  });

  it.each(['PRIMARY_STANDARD', 'O_LEVEL_TERM', 'O_LEVEL_NATIONAL_READY', 'A_LEVEL_COMBINATION', 'A_LEVEL_NATIONAL_READY'])(
    'renders the %s template, including an empty result set, without throwing',
    async (reportTemplateCode) => {
      const config = { get: jest.fn().mockReturnValue(directory) } as unknown as ConfigService;
      const service = new ReportCardPdfService(config);

      const fileName = await service.generatePdf(
        buildInput({
          reportTemplateCode,
          studentId: `student-${reportTemplateCode}`,
          divisionSummary: { mode: 'X', division: 'Division II', descriptor: 'Credit', totalPoints: 18 },
          results: [{ subjectName: 'Physics', subjectRole: 'PRINCIPAL', total: 71, grade: 'B', remark: 'Good', gradePoints: 4 }],
        }),
      );
      const empty = await service.generatePdf(
        buildInput({ reportTemplateCode, studentId: `empty-${reportTemplateCode}`, results: [] }),
      );

      expect(pageCount(fileName)).toBe(1);
      expect(pageCount(empty)).toBe(1);
    },
  );
});
