import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ReportCardsController } from './report-cards.controller';

describe('ReportCardsController bulk archive transport', () => {
  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'report-card-zip-'));
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('returns a complete ZIP as base64 JSON for browser-safe downloads', async () => {
    await writeFile(join(storageRoot, 'student-1.pdf'), Buffer.from('%PDF-1.4\nstudent one'));
    await writeFile(join(storageRoot, 'student-2.pdf'), Buffer.from('%PDF-1.4\nstudent two'));

    const controller = new ReportCardsController(
      {} as any,
      {} as any,
      { get: jest.fn().mockReturnValue(storageRoot) } as any,
    );
    const response = { json: jest.fn((value) => value) };

    const result = await (controller as any).streamBulkDownload(
      [
        {
          pdfUrl: 'student-1.pdf', studentId: 'student-1', classId: 'class-1',
          className: 'Class 1 A', registrationNumber: 'KEMS-P-26001', rank: 1,
        },
        {
          pdfUrl: 'student-2.pdf', studentId: 'student-2', classId: 'class-1',
          className: 'Class 1 A', registrationNumber: 'KEMS-P-26002', rank: 2,
        },
      ],
      'Class 1 A Annual Exam',
      'zip-base64',
      response,
    );

    expect(response.json).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      filename: 'Class_1_A_Annual_Exam.zip',
      mimeType: 'application/zip',
      reportCardCount: 2,
    });
    const archive = Buffer.from(result.base64, 'base64');
    expect(archive.subarray(0, 2).toString('ascii')).toBe('PK');
    expect(archive.includes(Buffer.from('001_Class_1_A_KEMS-P-26001.pdf'))).toBe(true);
    expect(archive.includes(Buffer.from('002_Class_1_A_KEMS-P-26002.pdf'))).toBe(true);
  });
});
