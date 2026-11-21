import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Gender, HostelLeaveStatus, ResidenceType, RollCallSession, StudentStatus } from '../../generated/prisma';
import { BoardingService } from './boarding.service';

const schoolAdmin = { id: 'admin-1', role: 'SYSTEM_ADMIN', scope: 'SCHOOL' as const, schoolIds: ['school-a'], activeSchoolId: 'school-a' };
const matron = { id: 'matron-1', role: 'MATRON', scope: 'SCHOOL' as const, schoolIds: ['school-a'], activeSchoolId: 'school-a' };
const dorm = { id: 'dorm-a', schoolId: 'school-a', name: 'Kibo', code: 'KB', totalBeds: 1, isActive: true };

function buildService() {
  const prisma = {
    dormitory: { findUnique: jest.fn() },
    dormitoryStaffAssignment: { findFirst: jest.fn() },
    dormitoryStudentAssignment: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    dormitoryBed: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    studentLeave: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  return { service: new BoardingService(prisma as any), prisma };
}

describe('BoardingService hostel boundaries', () => {
  it('rejects a Matron or Patron who changes the URL to an unassigned dormitory', async () => {
    const { service, prisma } = buildService();
    prisma.dormitory.findUnique.mockResolvedValue(dorm);
    prisma.dormitoryStaffAssignment.findFirst.mockResolvedValue(null);
    await expect(service.detail(dorm.id, matron)).rejects.toThrow(ForbiddenException);
  });

  it('does not house a Day Scholar', async () => {
    const { service, prisma } = buildService();
    prisma.dormitory.findUnique.mockResolvedValue(dorm);
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1', schoolId: 'school-a', residenceType: ResidenceType.DAY_SCHOLAR,
      gender: Gender.FEMALE, status: StudentStatus.ACTIVE,
    });
    await expect(service.assignStudent(dorm.id, { studentId: 'student-1' }, schoolAdmin.id, schoolAdmin))
      .rejects.toThrow(BadRequestException);
  });

  it('prevents dormitory capacity from being exceeded', async () => {
    const { service, prisma } = buildService();
    prisma.dormitory.findUnique.mockResolvedValue(dorm);
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1', schoolId: 'school-a', residenceType: ResidenceType.BOARDING });
    prisma.dormitoryStudentAssignment.findFirst.mockResolvedValue(null);
    prisma.dormitoryStudentAssignment.count.mockResolvedValue(1);
    await expect(service.assignStudent(dorm.id, { studentId: 'student-1' }, schoolAdmin.id, schoolAdmin))
      .rejects.toThrow(ConflictException);
  });

  it('rejects leave state changes outside the controlled flow', async () => {
    const { service, prisma } = buildService();
    prisma.studentLeave.findUnique.mockResolvedValue({ id: 'leave-1', dormitoryId: dorm.id, status: HostelLeaveStatus.REQUESTED });
    prisma.dormitory.findUnique.mockResolvedValue(dorm);
    await expect(service.transitionLeave('leave-1', { status: HostelLeaveStatus.RETURNED }, schoolAdmin.id, schoolAdmin))
      .rejects.toThrow(BadRequestException);
    expect(prisma.studentLeave.update).not.toHaveBeenCalled();
  });

  it('only permits today’s Morning or Evening roll call to be recorded or edited', async () => {
    const { service, prisma } = buildService();
    prisma.dormitory.findUnique.mockResolvedValue(dorm);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await expect(service.recordRollCall(dorm.id, {
      date: yesterday,
      session: RollCallSession.MORNING,
      records: [],
    }, schoolAdmin.id, schoolAdmin)).rejects.toThrow('current date');
    expect(prisma.dormitoryStudentAssignment.findMany).not.toHaveBeenCalled();
  });
});
