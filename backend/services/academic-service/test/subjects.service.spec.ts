import { ConflictException } from '@nestjs/common';
import { SubjectsService } from '../src/subjects/subjects.service';

describe('SubjectsService subject codes', () => {
  function setup() {
    const prisma = {
      subject: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      classSubject: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const redis = { del: jest.fn().mockResolvedValue(undefined) };
    const studentClient = { get: jest.fn() };
    const authClient = { getUserById: jest.fn() };
    const service = new SubjectsService(prisma as any, redis as any, studentClient as any, authClient as any);
    return { service, prisma, redis, studentClient, authClient };
  }

  it('creates an O-Level subject even when the code is used by another stage', async () => {
    const { service, prisma, redis } = setup();
    prisma.subject.findFirst.mockResolvedValue(null);
    prisma.subject.create.mockResolvedValue({ id: 'subject-1', name: 'Biology', code: 'BIO', educationStage: 'O_LEVEL' });

    await expect(service.createSubject({ name: ' Biology ', code: ' bio ', educationStage: 'O_LEVEL' as any }))
      .resolves.toMatchObject({ id: 'subject-1', code: 'BIO' });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { code: 'BIO', educationStage: 'O_LEVEL' },
    });
    expect(prisma.subject.create).toHaveBeenCalledWith({
      data: { name: 'Biology', code: 'BIO', educationStage: 'O_LEVEL' },
    });
    expect(redis.del).toHaveBeenCalledWith('subjects:all');
  });

  it('reuses an identical subject already created for another school', async () => {
    const { service, prisma, redis } = setup();
    prisma.subject.findFirst.mockResolvedValue({
      id: 'existing',
      name: 'Basic Mathematics',
      code: 'MATHS',
      educationStage: 'O_LEVEL',
      isActive: true,
    });

    await expect(service.createSubject({
      name: '  basic   mathematics ',
      code: ' maths ',
      educationStage: 'O_LEVEL' as any,
    })).resolves.toMatchObject({ id: 'existing', reused: true });

    expect(prisma.subject.create).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('returns a clear conflict for a duplicate code in the same stage', async () => {
    const { service, prisma } = setup();
    prisma.subject.findFirst.mockResolvedValue({ id: 'existing', name: 'Biology' });

    await expect(service.createSubject({ name: 'Biological Science', code: 'BIO', educationStage: 'O_LEVEL' as any }))
      .rejects.toThrow(new ConflictException(
        'Subject code BIO already exists for O-LEVEL as "Biology". Use the existing subject or choose a different code.',
      ));
    expect(prisma.subject.create).not.toHaveBeenCalled();
  });

  it('converts a concurrent unique-index collision into the same clear conflict', async () => {
    const { service, prisma } = setup();
    prisma.subject.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing', name: 'Biology', code: 'BIO', educationStage: 'O_LEVEL' });
    prisma.subject.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createSubject({ name: 'Biological Science', code: 'BIO', educationStage: 'O_LEVEL' as any }))
      .rejects.toThrow('Subject code BIO already exists for O-LEVEL as "Biology"');
  });

  it('keeps assignments for a shared subject isolated by school', async () => {
    const { service, prisma, studentClient, authClient } = setup();
    studentClient.get
      .mockResolvedValueOnce([{
        id: 'class-1', schoolId: 'school-1', academicYearId: 'year-1', educationStage: 'O_LEVEL', level: 1,
      }])
      .mockResolvedValueOnce([{
        id: 'class-2', schoolId: 'school-2', academicYearId: 'year-1', educationStage: 'O_LEVEL', level: 1,
      }]);
    authClient.getUserById.mockResolvedValue({
      id: 'teacher-1', role: 'TEACHER', isActive: true, schoolIds: ['school-1', 'school-2'],
    });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isActive: true, educationStage: 'O_LEVEL' });
    prisma.classSubject.findFirst.mockResolvedValue(null);
    prisma.classSubject.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `assignment-${data.schoolId}`, ...data }));

    const base = { subjectId: 'subject-1', teacherId: 'teacher-1', academicYearId: 'year-1' };
    const first = await service.createClassSubject(
      { ...base, classId: 'class-1' } as any,
      { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1' } as any,
    );
    const second = await service.createClassSubject(
      { ...base, classId: 'class-2' } as any,
      { id: 'admin-2', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-2'], activeSchoolId: 'school-2' } as any,
    );

    expect(first).toMatchObject({ subjectId: 'subject-1', schoolId: 'school-1', classId: 'class-1' });
    expect(second).toMatchObject({ subjectId: 'subject-1', schoolId: 'school-2', classId: 'class-2' });
  });
});
