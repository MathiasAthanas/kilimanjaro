import { BadRequestException, ConflictException } from '@nestjs/common';
import { HostelLeaveStatus, ResidenceChangeStatus, ResidenceType, StudentStatus } from '../../generated/prisma';
import { ResidenceService } from './residence.service';

const admin = { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL' as const, schoolIds: ['school-a'], activeSchoolId: 'school-a' };
const student = (over: Record<string, unknown> = {}) => ({
  id: 'stu-1', schoolId: 'school-a', registrationNumber: 'REG1', status: StudentStatus.ACTIVE, residenceType: ResidenceType.BOARDING, ...over,
});

function build() {
  const tx = {
    dormitoryStudentAssignment: { findFirst: jest.fn(), update: jest.fn() },
    studentLeave: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    dormitoryBed: { update: jest.fn() },
    student: { update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'stu-1', ...data })) },
    residenceChange: { create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'chg-1', ...data })), update: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    student: { findUnique: jest.fn(), findMany: jest.fn() },
    term: { findMany: jest.fn() },
    class: { findUnique: jest.fn() },
    residenceChange: { updateMany: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const redis = { del: jest.fn() };
  const rabbit = { publish: jest.fn() };
  return { service: new ResidenceService(prisma as any, redis as any, rabbit as any), prisma, tx, redis, rabbit };
}

describe('ResidenceService', () => {
  it('refuses to "change" a student to the type they already have', async () => {
    const { service, prisma } = build();
    prisma.student.findUnique.mockResolvedValue(student());
    await expect(service.change('stu-1', { residenceType: ResidenceType.BOARDING, effective: 'NOW' }, admin)).rejects.toThrow(BadRequestException);
  });

  it('says clearly when next term is chosen but no upcoming term exists', async () => {
    const { service, prisma } = build();
    prisma.student.findUnique.mockResolvedValue(student());
    prisma.term.findMany.mockResolvedValue([]);
    await expect(service.change('stu-1', { residenceType: ResidenceType.DAY_SCHOLAR, effective: 'NEXT_TERM' }, admin)).rejects.toThrow(/upcoming term/);
  });

  it('schedules a change for the start of next term without touching the student', async () => {
    const { service, prisma, tx } = build();
    prisma.student.findUnique.mockResolvedValue(student());
    prisma.term.findMany.mockResolvedValue([{ id: 'term-9', name: 'Term 1 2027', schoolId: null, startDate: new Date('2027-01-12') }]);
    const result: any = await service.change('stu-1', { residenceType: ResidenceType.DAY_SCHOLAR, effective: 'NEXT_TERM', reason: 'moved' }, admin);
    expect(result.applied).toBe(false);
    expect(tx.residenceChange.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ResidenceChangeStatus.SCHEDULED, effectiveTermId: 'term-9', toType: ResidenceType.DAY_SCHOLAR }) }));
    expect(tx.student.update).not.toHaveBeenCalled();
  });

  it('frees the bed and records history when a boarder becomes a day scholar now', async () => {
    const { service, prisma, tx, rabbit } = build();
    prisma.student.findUnique.mockResolvedValue(student());
    tx.dormitoryStudentAssignment.findFirst.mockResolvedValue({ id: 'asg-1', bedId: 'bed-1', dormitoryId: 'dorm-1' });
    tx.studentLeave.findFirst.mockResolvedValue(null);
    const result: any = await service.change('stu-1', { residenceType: ResidenceType.DAY_SCHOLAR, effective: 'NOW', reason: 'moved' }, admin);
    expect(result.applied).toBe(true);
    expect(tx.dormitoryStudentAssignment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
    expect(tx.dormitoryBed.update).toHaveBeenCalledWith({ where: { id: 'bed-1' }, data: { status: 'AVAILABLE' } });
    expect(tx.residenceChange.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromType: ResidenceType.BOARDING, toType: ResidenceType.DAY_SCHOLAR, releasedDormitoryId: 'dorm-1' }) }));
    expect(rabbit.publish).toHaveBeenCalledWith('student.residence.changed', expect.objectContaining({ previousResidenceType: ResidenceType.BOARDING, residenceType: ResidenceType.DAY_SCHOLAR }));
  });

  it('will not release a student who is currently away on leave', async () => {
    const { service, prisma, tx } = build();
    prisma.student.findUnique.mockResolvedValue(student());
    tx.dormitoryStudentAssignment.findFirst.mockResolvedValue({ id: 'asg-1', bedId: 'bed-1', dormitoryId: 'dorm-1' });
    tx.studentLeave.findFirst.mockResolvedValue({ id: 'leave-1', status: HostelLeaveStatus.DEPARTED });
    await expect(service.change('stu-1', { residenceType: ResidenceType.DAY_SCHOLAR, effective: 'NOW' }, admin)).rejects.toThrow(ConflictException);
    expect(tx.student.update).not.toHaveBeenCalled();
  });

  it('bulk classification only touches students that have no classification yet', async () => {
    const { service, prisma } = build();
    prisma.student.findMany.mockResolvedValue([
      { id: 'a', schoolId: 'school-a', residenceType: null },
      { id: 'b', schoolId: 'school-a', residenceType: ResidenceType.DAY_SCHOLAR },
    ]);
    const apply = jest.spyOn(service, 'applyNow').mockResolvedValue({} as any);
    const result = await service.bulkClassify({ residenceType: ResidenceType.BOARDING, studentIds: ['a', 'b'] }, admin);
    expect(result).toEqual({ requested: 2, updated: 1, skipped: 1 });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('a', ResidenceType.BOARDING, expect.objectContaining({ source: 'BULK' }));
  });

  it('applies due scheduled changes and keeps going when one fails', async () => {
    const { service, prisma } = build();
    prisma.residenceChange.findMany.mockResolvedValue([
      { id: 'c1', studentId: 's1', toType: ResidenceType.BOARDING, changedBy: 'x', changedByRole: null, effectiveTermId: 't1' },
      { id: 'c2', studentId: 's2', toType: ResidenceType.BOARDING, changedBy: 'x', changedByRole: null, effectiveTermId: 't1' },
    ]);
    jest.spyOn(service, 'applyNow').mockResolvedValueOnce({} as any).mockRejectedValueOnce(new Error('away on leave'));
    await expect(service.applyDueScheduled()).resolves.toEqual({ applied: 1, failed: 1 });
  });
});
