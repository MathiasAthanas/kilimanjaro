import * as ExcelJS from 'exceljs';
import { PerformanceExportService } from '../src/exams/performance-export.service';

describe('PerformanceExportService', () => {
  const user = {
    id: 'admin-1',
    role: 'SYSTEM_ADMIN',
    scope: 'SCHOOL',
    schoolIds: ['school-1'],
    activeSchoolId: 'school-1',
  } as any;

  function setup() {
    const prisma = {
      examWindow: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'window-1',
          name: 'Annual Exam',
          termId: 'term-1',
          academicYearId: 'year-1',
          schoolId: 'school-1',
        }),
      },
      examWindowResult: {
        findMany: jest.fn().mockResolvedValue([
          {
            studentId: 'student-a',
            mean: 76,
            overallGrade: 'B',
            division: 'Division II',
            subjectsAssessed: 2,
            subjectsExpected: 2,
            subjectScores: {
              math: { subjectId: 'math', subjectName: 'Mathematics', percentage: 80, grade: 'A', status: 'SCORED' },
              english: { subjectId: 'english', subjectName: 'English', percentage: null, grade: '', status: 'ABSENT' },
              science: { subjectId: 'science', subjectName: 'Science', percentage: null, grade: '', status: 'MISSING' },
            },
          },
          {
            studentId: 'student-b',
            mean: 64,
            overallGrade: 'C',
            division: 'Division III',
            subjectsAssessed: 1,
            subjectsExpected: 1,
            subjectScores: {
              math: { subjectId: 'math', subjectName: 'Mathematics', percentage: 64, grade: 'C', status: 'SCORED' },
            },
          },
        ]),
      },
    };
    const studentClient = {
      get: jest.fn(async (path: string, params?: Record<string, unknown>) => {
        if (path === '/students/classes') {
          return {
            data: [
              { id: 'class-a', name: 'Class 1 A', level: 1, stream: 'A', educationStage: 'PRIMARY', schoolId: 'school-1' },
              { id: 'class-b', name: 'Class 1 B', level: 1, stream: 'B', educationStage: 'PRIMARY', schoolId: 'school-1' },
            ],
          };
        }
        if (path === '/students' && params?.classId === 'class-a') {
          return { data: [{ id: 'student-a', registrationNumber: 'KPS-001', firstName: 'Asha', lastName: 'Ali', gender: 'FEMALE' }] };
        }
        if (path === '/students' && params?.classId === 'class-b') {
          return { data: [{ id: 'student-b', registrationNumber: 'KPS-002', firstName: 'Baraka', lastName: 'Bora', gender: 'MALE' }] };
        }
        if (path === '/schools/school-1') return { data: { name: 'Kilimanjaro Primary School' } };
        throw new Error(`Unexpected request: ${path}`);
      }),
    };

    return new PerformanceExportService(prisma as any, studentClient as any);
  }

  it('builds class-specific Primary sheets with clean headings and status values', async () => {
    const service = setup();
    const report = await service.build({ examWindowId: 'window-1', educationStage: 'PRIMARY', level: 1 }, user);

    expect(report.schoolName).toBe('Kilimanjaro Primary School');
    expect(report.standards[0].subjects.map((subject) => subject.label)).toEqual(['English', 'Mathematics']);
    expect(report.standards[0].streams.find((stream) => stream.classId === 'class-b')?.subjects.map((subject) => subject.label))
      .toEqual(['Mathematics']);

    const exported = await service.buildWorkbook({ examWindowId: 'window-1', educationStage: 'PRIMARY', level: 1 }, user);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.buffer as any);

    const overall = workbook.getWorksheet('Class 1 overall');
    expect(overall).toBeDefined();
    expect(overall!.getCell('A1').value).toBe('Kilimanjaro Primary School');
    expect(overall!.getCell('A2').value).toBe('Class One Performance');
    expect(overall!.getCell('A3').value).toBe('Annual Exam');

    const overallHeaders = overall!.getRow(4).values as unknown[];
    expect(overallHeaders[1]).toBe('NO.');
    expect(overallHeaders).not.toContain('DIVISION');
    expect(overallHeaders).not.toContain('Science');
    expect(overallHeaders.slice(-2)).toEqual(['STREAM POSITION', 'OVERALL POSITION']);
    const englishColumn = overallHeaders.indexOf('English');
    expect(overall!.getRow(5).getCell(englishColumn).value).toBe('-');

    const streamB = workbook.getWorksheet('Class 1 B');
    const streamBHeaders = streamB!.getRow(4).values as unknown[];
    expect(streamBHeaders).toContain('Mathematics');
    expect(streamBHeaders).not.toContain('English');
    expect(streamBHeaders).not.toContain('Science');
  });
});
