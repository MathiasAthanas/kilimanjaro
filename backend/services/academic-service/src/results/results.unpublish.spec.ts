import { ForbiddenException } from '@nestjs/common';
import { ResultsService } from './results.service';

describe('ResultsService result visibility lifecycle', () => {
  const user = {
    id: 'admin-1',
    role: 'SYSTEM_ADMIN',
    scope: 'SCHOOL' as const,
    schoolIds: ['school-1'],
    activeSchoolId: 'school-1',
  };

  const build = (schoolId = 'school-1') => {
    const prisma = {
      reportCard: {
        findFirst: jest.fn().mockResolvedValue({ schoolId }),
        count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.isPublished ? 17 : 17)),
        updateMany: jest.fn().mockResolvedValue({ count: 17 }),
      },
      termResult: {
        findFirst: jest.fn(),
        count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.isPublished ? 153 : 153)),
        updateMany: jest.fn().mockResolvedValue({ count: 153 }),
      },
      academicAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations)),
    } as any;
    const redis = { del: jest.fn(), delByPattern: jest.fn() } as any;
    const rabbit = { publish: jest.fn() } as any;
    const service = new ResultsService(prisma, redis, rabbit, {} as any, {} as any, undefined);
    return { service, prisma, redis, rabbit };
  };

  it('shows the exact non-destructive impact to a school administrator', async () => {
    const { service } = build();

    await expect(service.previewUnpublishResults('class-1', 'term-1', user)).resolves.toEqual({
      classId: 'class-1',
      termId: 'term-1',
      termResults: 153,
      publishedTermResults: 153,
      reportCards: 17,
      publishedReportCards: 17,
      canUnpublish: true,
      deletesRecords: false,
      marksAffected: 0,
    });
  });

  it('unpublishes visibility only and records the administrator reason', async () => {
    const { service, prisma, redis, rabbit } = build();

    await expect(service.unpublishResults({
      classId: 'class-1',
      termId: 'term-1',
      reason: 'Added French results',
    }, user)).resolves.toEqual({ unpublished: true, termResults: 153, reportCards: 17 });

    expect(prisma.termResult.updateMany).toHaveBeenCalledWith({
      where: { classId: 'class-1', termId: 'term-1', isPublished: true },
      data: { isPublished: false, publishedAt: null },
    });
    expect(prisma.reportCard.updateMany).toHaveBeenCalledWith({
      where: { classId: 'class-1', termId: 'term-1', isPublished: true },
      data: { isPublished: false, publishedAt: null },
    });
    expect(prisma.academicAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'RESULTS_UNPUBLISHED',
        performedById: 'admin-1',
        payload: expect.objectContaining({ reason: 'Added French results' }),
      }),
    });
    expect(redis.del).toHaveBeenCalledWith('class-results:class-1:term-1');
    expect(rabbit.publish).toHaveBeenCalledWith('results.unpublished', { classId: 'class-1', termId: 'term-1' });
  });

  it('blocks an administrator from changing another school', async () => {
    const { service, prisma } = build('school-2');

    await expect(service.previewUnpublishResults('class-1', 'term-1', user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.reportCard.count).not.toHaveBeenCalled();
  });
});
