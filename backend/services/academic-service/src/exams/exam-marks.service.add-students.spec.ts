import { ExamMarksService } from './exam-marks.service';
import { resolveExpectedStudents } from './engine/expected-students';

jest.mock('./engine/expected-students', () => ({ resolveExpectedStudents: jest.fn() }));

const ADMIN = { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1' } as any;
const TEACHER = { id: 'teacher-1', role: 'TEACHER', scope: 'SCHOOL', schoolIds: ['school-1'], activeSchoolId: 'school-1' } as any;

const student = (id: string, reg: string, first: string) => ({ id, registrationNumber: reg, firstName: first, lastName: 'Test' });

function build(opts: { windowStatus?: string; combinationId?: string | null; exemptions?: Array<{ studentId: string | null }>; expected?: string[]; exempt?: string[]; required?: string[] } = {}) {
  const assessment = {
    id: 'a-1', schoolId: 'school-1', classId: 'class-1', subjectId: 'sub-1', termId: 'term-1', academicYearId: 'year-1',
    classSubjectId: 'cs-1', examWindowId: 'w-1', maxScore: 100, status: 'OPEN', educationStage: 'O_LEVEL',
    classSubject: { teacherId: 'teacher-1', combinationId: opts.combinationId ?? null, subject: { name: 'French', code: 'FRN', isCompulsory: false } },
    examWindow: { id: 'w-1', name: 'Annual', status: opts.windowStatus ?? 'REOPENED', maxScore: 100, termId: 'term-1' },
  };
  (resolveExpectedStudents as jest.Mock).mockResolvedValue({
    expected: new Set(opts.expected ?? ['s1', 's2']),
    exempt: new Set(opts.exempt ?? ['s2']),
    required: new Set(opts.required ?? ['s1']),
  });
  const prisma: any = {
    assessment: { findUnique: jest.fn().mockResolvedValue(assessment), update: jest.fn() },
    mark: {
      findMany: jest.fn().mockResolvedValue([{ studentId: 's2', score: 0, isAbsent: true, notSat: true, note: null }]),
      upsert: jest.fn(),
      count: jest.fn().mockResolvedValue(2),
    },
    resultCalculationExemption: {
      findMany: jest.fn().mockResolvedValue(opts.exemptions ?? [{ studentId: 's2' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studentSubjectEnrollment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    academicAuditLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  const studentClient = {
    get: jest.fn().mockResolvedValue({
      data: [student('s1', 'ADM1', 'Amina'), student('s2', 'ADM2', 'Baraka'), student('s3', 'ADM3', 'Chausiku')],
    }),
  };
  const redis = { del: jest.fn(), delByPattern: jest.fn() };
  const service = new ExamMarksService(prisma, redis as any, studentClient as any, { submitAssessment: jest.fn() } as any);
  return { service, prisma, redis };
}

describe('ExamMarksService "add students"', () => {
  it('lists exempt and unregistered class students as addable, with the reason', async () => {
    const { service } = build();
    const data = await service.getTemplateData('a-1', ADMIN);
    expect(data.rows.map((r) => r.registrationNumber)).toEqual(['ADM1']);
    expect(data.addable.map((a) => [a.registrationNumber, a.reason, a.canAdd])).toEqual([
      ['ADM2', 'EXEMPT', true],
      ['ADM3', 'NOT_TAKING', true],
    ]);
    // A mark already on file (the recorded Not sat) is carried along, not lost.
    expect(data.addable[0].existing).toEqual({ score: 0, isAbsent: true, notSat: true });
  });

  it('only administrators may add students who are not registered for the subject', async () => {
    const { service } = build();
    const data = await service.getTemplateData('a-1', TEACHER);
    const unregistered = data.addable.find((a) => a.registrationNumber === 'ADM3')!;
    expect(unregistered).toMatchObject({ canAdd: false, blockedBy: 'ADMIN_ONLY' });
    // The teacher can still add an exempt student of their own subject.
    expect(data.addable.find((a) => a.registrationNumber === 'ADM2')).toMatchObject({ canAdd: true });
  });

  it('blocks combination subjects and class-wide exemptions that adding cannot fix', async () => {
    const combo = await build({ combinationId: 'combo-1' }).service.getTemplateData('a-1', ADMIN);
    expect(combo.addable.find((a) => a.registrationNumber === 'ADM3')).toMatchObject({ canAdd: false, blockedBy: 'COMBINATION' });

    const classWide = await build({ exemptions: [{ studentId: null }] }).service.getTemplateData('a-1', ADMIN);
    expect(classWide.addable.find((a) => a.registrationNumber === 'ADM2')).toMatchObject({ canAdd: false, blockedBy: 'CLASS_EXEMPTION' });
  });

  it('saves the mark, lifts the exemption and audits it when an exempt student is added', async () => {
    const { service, prisma, redis } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ studentId: 's2', score: 64, add: true }] }, TEACHER);
    expect(res.errors).toEqual([]);
    expect(res.applied).toBe(1);
    expect(res.added).toBe(1);
    expect(prisma.resultCalculationExemption.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ studentId: 's2', classId: 'class-1', subjectId: 'sub-1' }), data: expect.objectContaining({ status: 'REVOKED', revokedById: 'teacher-1' }) }),
    );
    expect(prisma.mark.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ studentId: 's2', score: 64, notSat: false, isAbsent: false }) }));
    expect(prisma.academicAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'MARKS_ADD_EXEMPT_STUDENT' }) }));
    expect(redis.delByPattern).toHaveBeenCalledWith('exam-window:*:w-1');
  });

  it('registers an unregistered student for the subject when an administrator adds them', async () => {
    const { service, prisma } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ registrationNumber: 'ADM3', score: 51, add: true }] }, ADMIN);
    expect(res.errors).toEqual([]);
    expect(prisma.studentSubjectEnrollment.create).toHaveBeenCalledWith({
      data: { studentId: 's3', classId: 'class-1', subjectId: 'sub-1', academicYearId: 'year-1', termId: null },
    });
    expect(prisma.mark.upsert).toHaveBeenCalled();
  });

  it('refuses a teacher adding an unregistered student, and changes nothing', async () => {
    const { service, prisma } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ studentId: 's3', score: 51, add: true }] }, TEACHER);
    expect(res.applied).toBe(0);
    expect(res.errors[0].message).toMatch(/Ask an administrator/);
    expect(prisma.studentSubjectEnrollment.create).not.toHaveBeenCalled();
    expect(prisma.mark.upsert).not.toHaveBeenCalled();
  });

  it('never accepts a student from another class', async () => {
    const { service, prisma } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ studentId: 'other-class-student', score: 70, add: true }] }, ADMIN);
    expect(res.applied).toBe(0);
    expect(res.errors[0].message).toMatch(/not a student of this class/);
    expect(prisma.mark.upsert).not.toHaveBeenCalled();
  });

  it('does not add students unless the row says so (existing behaviour unchanged)', async () => {
    const { service, prisma } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ studentId: 's2', score: 64 }] }, ADMIN);
    expect(res.applied).toBe(0);
    expect(res.errors[0].message).toMatch(/No student/);
    expect(prisma.resultCalculationExemption.updateMany).not.toHaveBeenCalled();
  });

  it('requires a score for an added student and leaves their exemption alone when the row is rejected', async () => {
    const { service, prisma } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ studentId: 's2', notSat: true, add: true }] }, ADMIN);
    expect(res.applied).toBe(0);
    expect(res.errors[0].message).toMatch(/enter a score/);
    expect(prisma.resultCalculationExemption.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range score for an added student without lifting the exemption', async () => {
    const { service, prisma } = build();
    const res = await service.uploadMarks('a-1', { rows: [{ studentId: 's2', score: 140, add: true }] }, ADMIN);
    expect(res.applied).toBe(0);
    expect(res.errors[0].message).toMatch(/out of range/);
    expect(prisma.resultCalculationExemption.updateMany).not.toHaveBeenCalled();
  });
});
