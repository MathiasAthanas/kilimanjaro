import { StudentImportService } from './student-import.service';

describe('StudentImportService Nursery preview', () => {
  it('uses the selected Baby Class and its school for the import preview', async () => {
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'baby-class-a',
          name: 'Baby Class A',
          stream: 'A',
          educationStage: 'NURSERY',
          combinationCode: null,
          schoolId: 'nursery-school',
          school: { id: 'nursery-school', name: 'Kilimanjaro Nursery', gender: 'BOTH' },
          academicYearId: 'year-2026',
          academicYear: { id: 'year-2026' },
        }),
      },
      student: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new StudentImportService(prisma as never, {} as never, {} as never);

    const report = await service.run({
      classId: 'baby-class-a',
      rows: [{ name: 'Asha Mushi', gender: 'FEMALE' }],
      commit: false,
    }, 'system-admin', {
      id: 'system-admin',
      role: 'ADMIN',
      scope: 'SCHOOL',
      schoolIds: ['nursery-school'],
      activeSchoolId: 'nursery-school',
    });

    expect(report).toMatchObject({
      committed: false,
      ready: 1,
      errors: 0,
      school: { id: 'nursery-school', name: 'Kilimanjaro Nursery' },
      class: { id: 'baby-class-a', name: 'Baby Class A', educationStage: 'NURSERY' },
    });
    expect(prisma.class.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'baby-class-a' } }));
  });
});
