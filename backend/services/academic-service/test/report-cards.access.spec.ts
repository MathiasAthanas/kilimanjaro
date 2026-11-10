import { ForbiddenException } from '@nestjs/common';
import { ReportCardsService } from '../src/report-cards/report-cards.service';

describe('ReportCardsService family access', () => {
  function setup(isPublished = true) {
    const card = {
      id: 'card-1',
      studentId: 'student-1',
      termId: 'term-1',
      schoolId: 'school-1',
      isPublished,
      pdfUrl: 'report_student-1_term-1.pdf',
    };
    const prisma = {
      reportCard: {
        findUnique: jest.fn().mockResolvedValue(card),
        findMany: jest.fn().mockResolvedValue(isPublished ? [card] : []),
      },
    };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const accessControl = {
      assertStudentOwnsRecord: jest.fn().mockResolvedValue(undefined),
      assertParentOwnsStudent: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ReportCardsService(
      prisma as any,
      redis as any,
      {} as any,
      {} as any,
      {} as any,
      accessControl as any,
      {} as any,
    );
    return { service, accessControl };
  }

  it('lets the owning student open and download a published report card', async () => {
    const { service, accessControl } = setup(true);
    const user = { id: 'student-user-1', role: 'STUDENT' } as any;

    await expect(service.getReportCard('student-1', 'term-1', user)).resolves.toMatchObject({ id: 'card-1' });
    await expect(service.getReportPdfPath('student-1', 'term-1', user)).resolves.toBe('report_student-1_term-1.pdf');
    expect(accessControl.assertStudentOwnsRecord).toHaveBeenCalledWith('student-user-1', 'student-1');
  });

  it('lets a linked parent open a published child report', async () => {
    const { service, accessControl } = setup(true);
    const user = { id: 'parent-user-1', role: 'PARENT' } as any;

    await expect(service.getReportCard('student-1', 'term-1', user)).resolves.toMatchObject({ id: 'card-1' });
    expect(accessControl.assertParentOwnsStudent).toHaveBeenCalledWith('parent-user-1', 'student-1');
  });

  it('keeps generated but unpublished cards hidden from families', async () => {
    const { service } = setup(false);
    const user = { id: 'student-user-1', role: 'STUDENT' } as any;

    await expect(service.getReportCard('student-1', 'term-1', user))
      .rejects.toThrow(new ForbiddenException('Report card not published'));
  });

  it('lists generated report-card classes from real cards within the active school scope', async () => {
    const updatedAt = new Date('2026-11-10T12:00:00.000Z');
    const prisma = {
      reportCard: {
        findMany: jest.fn().mockResolvedValue([
          {
            classId: 'class-1', termId: 'term-1', academicYearId: 'year-1', schoolId: 'school-1',
            educationStage: 'PRIMARY', isPublished: true, updatedAt,
          },
          {
            classId: 'class-1', termId: 'term-1', academicYearId: 'year-1', schoolId: 'school-1',
            educationStage: 'PRIMARY', isPublished: true, updatedAt,
          },
        ]),
      },
    };
    const studentClient = {
      get: jest.fn().mockResolvedValue([{ id: 'class-1', name: 'Class 1 A', stream: 'A' }]),
    };
    const service = new ReportCardsService(
      prisma as any,
      {} as any,
      studentClient as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const user = {
      id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL',
      schoolIds: ['school-1'], activeSchoolId: 'school-1',
    } as any;

    await expect(service.listAvailableClasses(user)).resolves.toEqual([
      expect.objectContaining({
        classId: 'class-1', className: 'Class 1 A', stream: 'A', termId: 'term-1',
        reportCards: 2, publishedCards: 2,
      }),
    ]);
    expect(prisma.reportCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: 'school-1' },
    }));
  });
});
