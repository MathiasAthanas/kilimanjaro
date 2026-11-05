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
    };
    const redis = { del: jest.fn().mockResolvedValue(undefined) };
    const service = new SubjectsService(prisma as any, redis as any, {} as any, {} as any);
    return { service, prisma, redis };
  }

  it('creates an O-Level subject even when the code is used by another stage', async () => {
    const { service, prisma, redis } = setup();
    prisma.subject.findFirst.mockResolvedValue(null);
    prisma.subject.create.mockResolvedValue({ id: 'subject-1', name: 'Biology', code: 'BIO', educationStage: 'O_LEVEL' });

    await expect(service.createSubject({ name: ' Biology ', code: ' bio ', educationStage: 'O_LEVEL' as any }))
      .resolves.toMatchObject({ id: 'subject-1', code: 'BIO' });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { code: 'BIO', educationStage: 'O_LEVEL' },
      select: { id: true, name: true },
    });
    expect(prisma.subject.create).toHaveBeenCalledWith({
      data: { name: 'Biology', code: 'BIO', educationStage: 'O_LEVEL' },
    });
    expect(redis.del).toHaveBeenCalledWith('subjects:all');
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
    prisma.subject.findFirst.mockResolvedValue(null);
    prisma.subject.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createSubject({ name: 'Chemistry', code: 'CHEM', educationStage: 'O_LEVEL' as any }))
      .rejects.toThrow('Subject code CHEM already exists for O-LEVEL');
  });
});
