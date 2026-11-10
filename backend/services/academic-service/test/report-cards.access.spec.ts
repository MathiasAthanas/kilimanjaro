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
});
