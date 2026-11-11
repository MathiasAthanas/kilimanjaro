import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { ReportCardBulkJobService } from './report-card-bulk-job.service';

describe('ReportCardBulkJobService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'report-card-job-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('prepares a durable ZIP artifact and records progress to READY', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    await writeFile(join(root, 'student.pdf'), Buffer.from(await pdf.save()));

    const mutable: any = {
      id: 'job-1', schoolId: 'school-1', requestedById: 'admin-1', requestedByRole: 'SYSTEM_ADMIN',
      scopeType: 'CLASS', classId: 'class-1', educationStage: null, classLevel: null,
      termId: 'term-1', examLabel: 'Annual Exam', format: 'zip', includeClassName: false,
      status: 'QUEUED', stage: 'QUEUED', progress: 0, processedFiles: 0, totalFiles: 1,
      fileName: 'Class_6_A_Report_Cards.zip', filePath: null, fileSize: null, errorMessage: null,
      startedAt: null, completedAt: null, expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(), updatedAt: new Date(),
    };
    const prisma = {
      bulkReportCardJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async () => ({ ...mutable })),
        findUnique: jest.fn().mockImplementation(async () => ({ ...mutable })),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          Object.assign(mutable, data, { updatedAt: new Date() });
          return { ...mutable };
        }),
      },
    };
    const reportCards = {
      bulkFiles: jest.fn().mockResolvedValue({
        schoolId: 'school-1', baseName: 'Class 6 A Report Cards',
        files: [{
          pdfUrl: 'student.pdf', studentId: 'student-1', studentName: 'Test Student',
          classId: 'class-1', className: 'Class 6 A', registrationNumber: 'KEMS-P-26001', rank: 1,
        }],
      }),
    };
    const service = new ReportCardBulkJobService(
      prisma as any, reportCards as any, { get: jest.fn().mockReturnValue(root) } as any,
    );

    await service.create({ scopeType: 'CLASS', classId: 'class-1', termId: 'term-1', examLabel: 'Annual Exam', format: 'zip' }, {
      id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1',
    });
    for (let attempt = 0; attempt < 100 && mutable.status !== 'READY'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(mutable).toMatchObject({ status: 'READY', stage: 'READY', progress: 100, processedFiles: 1, totalFiles: 1 });
    expect(mutable.filePath).toBe('bulk-jobs/job-1.zip');
    const archive = await readFile(join(root, mutable.filePath));
    expect(archive.subarray(0, 2).toString('ascii')).toBe('PK');
    expect(archive.includes(Buffer.from('Test Student - KEMS-P-26001.pdf'))).toBe(true);
  });
});
