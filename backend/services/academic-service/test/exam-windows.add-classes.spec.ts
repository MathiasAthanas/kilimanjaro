import { BadRequestException } from '@nestjs/common';
import { ExamWindowsService } from '../src/exams/exam-windows.service';

describe('ExamWindowsService.addClasses', () => {
  const user = { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1' } as any;
  const window = {
    id: 'window-1', schoolId: 'school-1', academicYearId: 'year-1', termId: 'term-1', educationStage: 'PRIMARY',
    scopeType: 'STREAMS', scopeLevels: [], scopeClassIds: ['class-1'], status: 'OPEN', name: 'Annual Exam',
    maxScore: 100, openedAt: new Date(),
  } as any;
  const current = { id: 'class-1', name: 'Class 1 A', level: 1, stream: 'A', educationStage: 'PRIMARY', schoolId: 'school-1' };
  const addition = { id: 'class-2', name: 'Class 2 A', level: 2, stream: 'A', educationStage: 'PRIMARY', schoolId: 'school-1' };

  function setup() {
    const tx = {
      examWindow: { update: jest.fn().mockResolvedValue({}) },
      assessment: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      classSubject: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'cs-2', schoolId: 'school-1', classId: 'class-2', subjectId: 'subject-1', academicYearId: 'year-1',
          teacherId: 'teacher-1', educationStage: 'PRIMARY', classLevel: 2, combinationId: null,
          subject: { id: 'subject-1', name: 'Mathematics', isActive: true },
        }]),
      },
      examSubjectExclusion: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const redis = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    const rabbit = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new ExamWindowsService(prisma as any, redis as any, rabbit as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'getWindowOrThrow').mockResolvedValue(window);
    jest.spyOn(service, 'resolveScopeClasses')
      .mockResolvedValueOnce([current, addition])
      .mockResolvedValueOnce([current]);
    jest.spyOn(service, 'detail').mockResolvedValue({ id: 'window-1' } as any);
    return { service, prisma, redis, rabbit, tx };
  }

  it('appends an eligible class and creates its marks sheets without removing existing scope', async () => {
    const { service, tx, rabbit } = setup();

    const result = await service.addClasses('window-1', { classIds: ['class-2'] }, user);

    expect(tx.examWindow.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'window-1' },
      data: expect.objectContaining({ scopeType: 'STREAMS', scopeClassIds: ['class-1', 'class-2'] }),
    }));
    expect(tx.assessment.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ classId: 'class-2', subjectId: 'subject-1', status: 'OPEN' })],
      skipDuplicates: true,
    }));
    expect(rabbit.publish).toHaveBeenCalledWith('exam.window.classes.added', expect.objectContaining({ classIds: ['class-2'] }));
    expect(result).toMatchObject({ addedClasses: 1, assessmentsCreated: 1 });
  });

  it('refuses to change a closed window', async () => {
    const { service } = setup();
    jest.spyOn(service as any, 'getWindowOrThrow').mockResolvedValue({ ...window, status: 'CLOSED' });

    await expect(service.addClasses('window-1', { classIds: ['class-2'] }, user))
      .rejects.toThrow('Reopen it first');
  });

  it('explains that subject assignments are required before a class can be added', async () => {
    const { service, prisma } = setup();
    prisma.classSubject.findMany.mockResolvedValue([]);

    await expect(service.addClasses('window-1', { classIds: ['class-2'] }, user))
      .rejects.toThrow(new BadRequestException('Class 2 A has no active subjects assigned. Assign subjects first, then add the class to the exam.'));
  });
});
