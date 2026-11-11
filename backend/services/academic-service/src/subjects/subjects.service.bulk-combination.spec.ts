import { SubjectsService } from './subjects.service';

describe('SubjectsService bulk A-Level combination assignment', () => {
  it('atomically replaces old combination enrollments', async () => {
    const tx = {
      studentSubjectEnrollment: {
        updateMany: jest.fn().mockResolvedValue({ count: 4 }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: `row-${data.subjectId}`, ...data })),
      },
    };
    const prisma = {
      subjectCombination: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'combo-cbg',
          educationStage: 'A_LEVEL',
          academicYearId: 'year-2026',
          schoolId: null,
          isActive: true,
          subjects: [{ subjectId: 'chem' }, { subjectId: 'bio' }, { subjectId: 'geo' }, { subjectId: 'gs' }],
        }),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const studentClient = {
      get: jest.fn().mockResolvedValue({ data: { items: [{ id: 'student-1', schoolId: 'school-1' }] } }),
    };
    const service = new SubjectsService(prisma as any, {} as any, studentClient as any, {} as any);

    const result = await service.bulkEnrollStudentCombination({
      studentIds: ['student-1'],
      classId: 'class-1',
      academicYearId: 'year-2026',
      combinationId: 'combo-cbg',
    }, {
      id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'GROUP', schoolIds: ['*'], activeSchoolId: 'school-1',
    });

    expect(tx.studentSubjectEnrollment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { isActive: false },
      where: expect.objectContaining({ combinationId: { not: null }, isActive: true }),
    }));
    expect(tx.studentSubjectEnrollment.create).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ combinationId: 'combo-cbg', studentsAssigned: 1, subjectEnrollments: 4 });
  });
});
