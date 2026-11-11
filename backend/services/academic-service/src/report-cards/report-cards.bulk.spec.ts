import { ReportCardsService } from './report-cards.service';

describe('ReportCardsService bulk downloads', () => {
  it('keeps a class download inside the active school and returns published PDFs only', async () => {
    const prisma = {
      reportCard: {
        findMany: jest.fn().mockResolvedValue([
          { pdfUrl: 'report_student-1_term-1.pdf', studentId: 'student-1', classId: 'class-1', rank: 1 },
        ]),
      },
    };
    const studentClient = {
      get: jest.fn().mockImplementation((path: string) => {
        if (path === '/students/classes') return Promise.resolve({ success: true, data: [{ id: 'class-1', name: 'Class 1 A', stream: 'A' }] });
        return Promise.resolve({ success: true, data: { students: [{ student: { id: 'student-1', registrationNumber: 'KEMS-P-26001' } }] } });
      }),
    };
    const service = new ReportCardsService(
      prisma as any, {} as any, studentClient as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const result = await service.bulkFiles(
      { classId: 'class-1' },
      'term-1',
      'Annual Exam',
      { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'GROUP', schoolIds: ['*'], activeSchoolId: 'school-1' },
    );

    expect(prisma.reportCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        schoolId: 'school-1', classId: 'class-1', termId: 'term-1', isPublished: true,
        examLabel: { equals: 'Annual Exam', mode: 'insensitive' },
      }),
    }));
    expect(result.files[0]).toMatchObject({
      studentId: 'student-1', className: 'Class 1 A', registrationNumber: 'KEMS-P-26001',
    });
  });

  it('infers the school for an unambiguous class download in group scope', async () => {
    const prisma = {
      reportCard: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ schoolId: 'school-1' }])
          .mockResolvedValueOnce([
            { pdfUrl: 'report_student-1_term-1.pdf', studentId: 'student-1', classId: 'class-1', rank: 1 },
          ]),
      },
    };
    const studentClient = {
      get: jest.fn().mockImplementation((path: string) => {
        if (path === '/students/classes') return Promise.resolve({ success: true, data: [{ id: 'class-1', name: 'Class 1 A', stream: 'A' }] });
        return Promise.resolve({ success: true, data: { students: [{ student: { id: 'student-1', registrationNumber: 'KEMS-P-26001' } }] } });
      }),
    };
    const service = new ReportCardsService(
      prisma as any, {} as any, studentClient as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const result = await service.bulkFiles(
      { classId: 'class-1' },
      'term-1',
      'Annual Exam',
      { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'GROUP', schoolIds: ['*'] },
    );

    expect(prisma.reportCard.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      distinct: ['schoolId'],
      where: expect.objectContaining({ classId: 'class-1', termId: 'term-1', isPublished: true }),
    }));
    expect(prisma.reportCard.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ schoolId: 'school-1', classId: 'class-1' }),
    }));
    expect(result.files).toHaveLength(1);
  });

  it('requires a school when an all-stream selection spans multiple schools', async () => {
    const prisma = {
      reportCard: {
        findMany: jest.fn().mockResolvedValue([{ schoolId: 'school-1' }, { schoolId: 'school-2' }]),
      },
    };
    const service = new ReportCardsService(
      prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    await expect(service.bulkFiles(
      { educationStage: 'PRIMARY', classLevel: 1 },
      'term-1',
      'Annual Exam',
      { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'GROUP', schoolIds: ['*'] },
    )).rejects.toThrow('Select a school before downloading report cards across multiple schools.');
  });
});
