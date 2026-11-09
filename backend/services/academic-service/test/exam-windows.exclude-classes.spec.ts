import { BadRequestException, ConflictException } from '@nestjs/common';
import { ExamWindowsService } from '../src/exams/exam-windows.service';

describe('ExamWindowsService class exclusion', () => {
  const user = { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1' } as any;
  const updatedAt = new Date('2026-11-09T08:00:00.000Z');
  const window = {
    id: 'window-1', schoolId: 'school-1', academicYearId: 'year-1', termId: 'term-1', educationStage: 'PRIMARY',
    scopeType: 'STREAMS', scopeLevels: [], scopeClassIds: ['class-1', 'class-2'], status: 'OPEN', name: 'Annual Exam',
    maxScore: 100, openedAt: new Date(), updatedAt,
  } as any;
  const classOne = { id: 'class-1', name: 'Class 1 A', level: 1, stream: 'A', educationStage: 'PRIMARY', schoolId: 'school-1' };
  const classTwo = { id: 'class-2', name: 'Class 2 A', level: 2, stream: 'A', educationStage: 'PRIMARY', schoolId: 'school-1' };

  function setup(marksEntered = 0) {
    const sheets = [{ id: 'assessment-2', classId: 'class-2', _count: { marks: marksEntered } }];
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'assessment-2' }]),
      examWindow: {
        findUnique: jest.fn().mockResolvedValue({ status: 'OPEN' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      assessment: {
        findMany: jest.fn().mockResolvedValue(sheets),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      examWindowResult: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      academicAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      assessment: { findMany: jest.fn().mockResolvedValue(sheets) },
      examWindowResult: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const redis = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    const rabbit = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new ExamWindowsService(prisma as any, redis as any, rabbit as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'getWindowOrThrow').mockResolvedValue(window);
    jest.spyOn(service, 'resolveScopeClasses').mockResolvedValue([classOne, classTwo]);
    jest.spyOn(service, 'detail').mockResolvedValue({ id: 'window-1' } as any);
    return { service, prisma, redis, rabbit, tx };
  }

  it('previews the exact marks and scope impact without changing data', async () => {
    const { service, prisma } = setup(4);

    const impact = await service.previewClassExclusion('window-1', { classIds: ['class-2'] }, user);

    expect(impact).toMatchObject({
      classIds: ['class-2'],
      remainingClassIds: ['class-1'],
      marksSheets: 1,
      marksEntered: 4,
      requiresDiscardConfirmation: true,
      confirmationText: 'EXCLUDE 1 CLASS',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to discard entered marks without explicit confirmation', async () => {
    const { service, prisma } = setup(4);

    await expect(service.excludeClasses('window-1', {
      classIds: ['class-2'], reason: 'Class did not sit this exam', discardMarks: false,
    }, user)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('removes only the exam data and records an audit event after confirmation', async () => {
    const { service, tx, rabbit, redis } = setup(4);

    const result = await service.excludeClasses('window-1', {
      classIds: ['class-2'], reason: 'Class did not sit this exam', discardMarks: true,
    }, user);

    expect(tx.assessment.deleteMany).toHaveBeenCalledWith({ where: { examWindowId: 'window-1', classId: { in: ['class-2'] } } });
    expect(tx.examWindow.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'window-1', updatedAt },
      data: expect.objectContaining({ scopeType: 'STREAMS', scopeClassIds: ['class-1'], computedAt: null }),
    }));
    expect(tx.academicAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'EXAM_WINDOW_CLASSES_EXCLUDED', performedById: 'admin-1' }),
    }));
    expect(rabbit.publish).toHaveBeenCalledWith('exam.window.classes.excluded', expect.objectContaining({ classIds: ['class-2'], marksDiscarded: 4 }));
    expect(redis.delByPattern).toHaveBeenCalledWith('exam-window:*:window-1');
    expect(result).toMatchObject({ excludedClasses: 1, marksSheetsRemoved: 1, marksDiscarded: 4 });
  });

  it('does not allow every class to be excluded', async () => {
    const { service } = setup();

    await expect(service.previewClassExclusion('window-1', { classIds: ['class-1', 'class-2'] }, user))
      .rejects.toThrow(new BadRequestException('An exam window must keep at least one class. Archive this window instead if the whole exam was cancelled.'));
  });
});
