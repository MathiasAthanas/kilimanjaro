import { PerformanceEngineService } from './performance-engine.service';

describe('PerformanceEngineService snapshot ingestion', () => {
  it('drops event routing metadata that is not part of PerformanceSnapshot', async () => {
    const prisma = {
      performanceSnapshot: {
        upsert: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
    };
    const service = new PerformanceEngineService(prisma as any, {} as any, {} as any);
    jest.spyOn(service as any, 'analyzeStudentSubject').mockResolvedValue({});
    jest.spyOn(service as any, 'recordPairingOutcome').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'invalidatePerformanceCache').mockResolvedValue(undefined);

    await service.ingestSnapshot({
      studentId: 'student-1',
      subjectId: 'subject-1',
      subjectName: 'History',
      classId: 'class-1',
      termId: 'term-1',
      academicYearId: 'year-1',
      score: 75,
      grade: 'B',
      assessmentBreakdown: { examWindowId: 'window-1' },
      rank: 2,
      totalStudentsInClass: 30,
      teacherId: 'teacher-1',
      schoolId: 'routing-only-school-id',
    } as any);

    const call = prisma.performanceSnapshot.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ studentId: 'student-1', subjectId: 'subject-1', teacherId: 'teacher-1' });
    expect(call.create).not.toHaveProperty('schoolId');
    expect(call.update).not.toHaveProperty('schoolId');
  });
});
