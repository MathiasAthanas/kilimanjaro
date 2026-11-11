import { GradingService } from './grading.service';
import { EducationStageDto } from './dto/create-grading-scale.dto';

describe('GradingService ACSEE normalization', () => {
  it('stores canonical A=1 through F=7 points and pass flags for A-Level scales', async () => {
    const prisma = {
      gradingScale: {
        create: jest.fn().mockImplementation(async ({ data }) => data),
      },
    };
    const redis = { delByPattern: jest.fn() };
    const service = new GradingService(prisma as any, redis as any);

    await service.createGradingScale({
      name: 'ACSEE',
      academicYearId: 'year-1',
      educationStage: EducationStageDto.A_LEVEL,
      grades: [
        { grade: 'A', minScore: 80, maxScore: 100, points: 5, remark: 'A', isPassing: false },
        { grade: 'B', minScore: 70, maxScore: 79, points: 4, remark: 'B', isPassing: false },
        { grade: 'C', minScore: 60, maxScore: 69, points: 3, remark: 'C', isPassing: false },
        { grade: 'D', minScore: 50, maxScore: 59, points: 2, remark: 'D', isPassing: false },
        { grade: 'E', minScore: 40, maxScore: 49, points: 1, remark: 'E', isPassing: false },
        { grade: 'S', minScore: 35, maxScore: 39, points: 0, remark: 'S', isPassing: true },
        { grade: 'F', minScore: 0, maxScore: 34, points: 0, remark: 'F', isPassing: true },
      ],
    }, {
      id: 'admin-1',
      role: 'SYSTEM_ADMIN',
      scope: 'GROUP',
      schoolIds: ['*'],
      activeSchoolId: 'school-1',
    });

    const grades = prisma.gradingScale.create.mock.calls[0][0].data.grades.create;
    expect(grades.map((row: any) => [row.grade, row.points, row.isPassing])).toEqual([
      ['A', 1, true],
      ['B', 2, true],
      ['C', 3, true],
      ['D', 4, true],
      ['E', 5, true],
      ['S', 6, false],
      ['F', 7, false],
    ]);
  });
});
