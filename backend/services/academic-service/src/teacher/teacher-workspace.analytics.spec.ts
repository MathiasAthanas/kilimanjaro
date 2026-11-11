import { TeacherWorkspaceService } from './teacher-workspace.service';

describe('TeacherWorkspaceService analytics', () => {
  it('counts published student grades for each subject and excludes exempt results', async () => {
    const prisma = {
      mark: {
        findMany: jest.fn().mockResolvedValue([
          { classSubjectId: 'cs-1', studentId: 'student-1', score: 80, assessment: { maxScore: 100, termId: 'term-1' } },
          { classSubjectId: 'cs-1', studentId: 'student-2', score: 65, assessment: { maxScore: 100, termId: 'term-1' } },
        ]),
      },
      termResult: {
        findMany: jest.fn().mockResolvedValue([
          { classSubjectId: 'cs-1', grade: 'A' },
          { classSubjectId: 'cs-1', grade: 'B' },
        ]),
      },
    };
    const studentClient = { get: jest.fn().mockResolvedValue({ data: [{ id: 'term-1', name: 'Term 3' }] }) };
    const grading = {
      getActiveScale: jest.fn().mockResolvedValue({
        grades: [
          { grade: 'A', minScore: 75, maxScore: 100, isPassing: true },
          { grade: 'B', minScore: 60, maxScore: 74, isPassing: true },
          { grade: 'F', minScore: 0, maxScore: 49, isPassing: false },
        ],
      }),
    };
    const service = new TeacherWorkspaceService(prisma as any, studentClient as any, grading as any);
    jest.spyOn(service, 'overview').mockResolvedValue({
      classes: [{
        classSubjectId: 'cs-1', classId: 'class-1', schoolId: 'school-1', academicYearId: 'year-1',
        stage: 'PRIMARY', level: 1, subjectId: 'math', subjectName: 'Mathematics', label: 'Class 1 A',
        studentCount: 2, syllabus: null,
      }],
    } as any);

    const result = await service.teacherAnalytics({ id: 'teacher-1', role: 'TEACHER', scope: 'SCHOOL', schoolIds: ['school-1'] }, {
      academicYearId: 'year-1', termId: 'term-1',
    });

    expect(prisma.termResult.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isPublished: true, resultStatus: { not: 'EXEMPT' } }),
    }));
    expect(result.courses[0]).toMatchObject({
      subjectName: 'Mathematics',
      gradeOrder: ['A', 'B', 'F'],
      gradeDistribution: { A: 1, B: 1, F: 0 },
      gradedResults: 2,
    });
  });
});
