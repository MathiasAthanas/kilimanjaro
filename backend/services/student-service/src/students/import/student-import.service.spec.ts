import { normalizeImportDate, StudentImportService } from './student-import.service';

describe('normalizeImportDate', () => {
  it('converts Excel serial dates to ISO dates', () => {
    expect(normalizeImportDate('45000')).toBe('2023-03-15');
    expect(normalizeImportDate(45030)).toBe('2023-04-14');
  });

  it('accepts valid ISO dates and rejects ambiguous or impossible values', () => {
    expect(normalizeImportDate('2010-03-15')).toBe('2010-03-15');
    expect(normalizeImportDate('2010-02-30')).toBeUndefined();
    expect(normalizeImportDate('03/15/2010')).toBeUndefined();
    expect(normalizeImportDate('450000')).toBeUndefined();
  });
});

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

  it('passes a normalized Excel serial DOB into student creation', async () => {
    const prisma = {
      class: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'baby-class-a',
          name: 'Baby Class A',
          stream: 'A',
          educationStage: 'NURSERY',
          combinationCode: null,
          schoolId: 'nursery-school',
          school: { id: 'nursery-school', name: 'Kilimanjaro Nursery', gender: 'MALE' },
          academicYearId: 'year-2026',
          academicYear: { id: 'year-2026' },
        }),
      },
      student: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const studentsService = {
      create: jest.fn().mockResolvedValue({ id: 'student-1', registrationNumber: 'KS-N-26001' }),
    };
    const authClient = {
      createStudentAccount: jest.fn().mockResolvedValue({ id: 'auth-1' }),
      setRegistrationNumber: jest.fn().mockResolvedValue(undefined),
      deleteAccount: jest.fn(),
    };
    const service = new StudentImportService(prisma as never, studentsService as never, authClient as never);

    const report = await service.run({
      classId: 'baby-class-a',
      rows: [{ name: 'Jonathan Wilson Ngowi', admissionNumber: 'BABY 030', dateOfBirth: '45000' }],
      commit: true,
    }, 'system-admin', {
      id: 'system-admin',
      role: 'ADMIN',
      scope: 'SCHOOL',
      schoolIds: ['nursery-school'],
      activeSchoolId: 'nursery-school',
    });

    expect(report).toMatchObject({ imported: 1, errors: 0 });
    expect(studentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: '2023-03-15' }),
      'system-admin',
      expect.any(Object),
    );
  });
});
