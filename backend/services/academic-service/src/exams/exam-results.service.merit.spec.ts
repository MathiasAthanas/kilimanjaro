import { ExamResultsService } from './exam-results.service';

describe('ExamResultsService A-Level merit display', () => {
  it('adds the active combination to a published row and retains division points', async () => {
    const prisma = {
      examWindow: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'window-1', schoolId: 'school-1', academicYearId: 'year-1', termId: 'term-1',
          name: 'Terminal Exam', status: 'CLOSED', maxScore: 100, computedAt: new Date(),
          publishedAt: null, examType: { id: 'type-1', name: 'Terminal', code: 'TERM' },
        }),
      },
      examWindowResult: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'result-1', examWindowId: 'window-1', schoolId: 'school-1', studentId: 'student-1',
          classId: 'class-1', className: 'Form 5 A', stream: 'A', classLevel: 5,
          educationStage: 'A_LEVEL', registrationNumber: 'KEMS-A-26001', studentName: 'Test Student',
          gender: 'FEMALE', subjectScores: {}, subjectCount: 3, subjectsExpected: 3, subjectsAssessed: 3,
          division: 'Division I', divisionPoints: 3, total: 240, mean: 80, overallGrade: 'A', isPassing: true,
          classMeanDev: 1, streamRank: 1, standardRank: 1,
        }]),
      },
      studentSubjectEnrollment: {
        findMany: jest.fn().mockResolvedValue([{ studentId: 'student-1', classId: 'class-1', combination: { code: 'HGE' } }]),
      },
      classSubject: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ExamResultsService(
      prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
    const result = await service.getMeritList('window-1', {
      id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1',
    });

    expect(result.rows[0]).toMatchObject({ combinationCode: 'HGE', division: 'Division I', divisionPoints: 3 });
    expect(result.summaries.overall).toMatchObject({ entries: 1, classes: 1, meanMarks: 80, passRate: 100 });
    expect(result.summaries.byStream[0]).toMatchObject({
      highestMarks: 80,
      lowestMarks: 80,
      passRate: 100,
      divisionDistribution: { 'Division I': 1 },
    });
    expect(prisma.studentSubjectEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ academicYearId: 'year-1', isActive: true }),
    }));
  });
});
