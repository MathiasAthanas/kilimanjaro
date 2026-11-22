import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BedStatus, HostelLeaveStatus, Prisma, ResidenceType, RollCallSession, StudentStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, requireWriteSchoolId, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import {
  AssignDormitoryStaffDto,
  AssignDormitoryStudentDto,
  CreateDormitoryDto,
  CreateStudentLeaveDto,
  RecordRollCallDto,
  TransitionStudentLeaveDto,
  UpdateDormitoryDto,
} from './boarding.dto';

const STAFF_ROLES = ['MATRON', 'PATRON'];
const ACTIVE_LEAVE = [HostelLeaveStatus.REQUESTED, HostelLeaveStatus.APPROVED, HostelLeaveStatus.DEPARTED];
const LEAVE_TRANSITIONS: Record<HostelLeaveStatus, HostelLeaveStatus[]> = {
  REQUESTED: [HostelLeaveStatus.APPROVED, HostelLeaveStatus.REJECTED, HostelLeaveStatus.CANCELLED],
  APPROVED: [HostelLeaveStatus.DEPARTED, HostelLeaveStatus.CANCELLED],
  REJECTED: [],
  DEPARTED: [HostelLeaveStatus.RETURNED],
  RETURNED: [],
  CANCELLED: [],
};

@Injectable()
export class BoardingService {
  constructor(private readonly prisma: PrismaService) {}

  private isDormStaff(user?: RequestUser) {
    return !!user && STAFF_ROLES.includes(user.role);
  }

  private async dormitory(id: string, user?: RequestUser) {
    const dorm = await this.prisma.dormitory.findUnique({ where: { id } });
    if (!dorm) throw new NotFoundException('Dormitory not found');
    assertSchoolInScope(user, dorm.schoolId);
    if (this.isDormStaff(user)) {
      const assigned = await this.prisma.dormitoryStaffAssignment.findFirst({
        where: { dormitoryId: id, staffUserId: user!.id, isActive: true },
      });
      if (!assigned) throw new ForbiddenException('You are not assigned to this dormitory');
    }
    return dorm;
  }

  async dashboard(user?: RequestUser) {
    const dorms = await this.listDormitories(user);
    const ids = dorms.map((d) => d.id);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const currentSession = new Date().getHours() < 12 ? RollCallSession.MORNING : RollCallSession.EVENING;
    const [away, pendingLeaves, rosterSize, markedToday, expectedReturnsToday] = ids.length ? await Promise.all([
      this.prisma.studentLeave.count({ where: { dormitoryId: { in: ids }, status: HostelLeaveStatus.DEPARTED } }),
      this.prisma.studentLeave.count({ where: { dormitoryId: { in: ids }, status: HostelLeaveStatus.REQUESTED } }),
      this.prisma.dormitoryStudentAssignment.count({ where: { dormitoryId: { in: ids }, isActive: true } }),
      this.prisma.hostelRollCall.count({ where: { dormitoryId: { in: ids }, date: startOfToday, session: currentSession } }),
      this.prisma.studentLeave.count({ where: { dormitoryId: { in: ids }, status: HostelLeaveStatus.DEPARTED, expectedReturnAt: { gte: startOfToday, lt: startOfTomorrow } } }),
    ]) : [0, 0, 0, 0, 0];
    const awaitingPlacement = await this.prisma.student.count({
      where: { ...schoolScopeFilter(user), status: StudentStatus.ACTIVE, residenceType: ResidenceType.BOARDING, dormitoryAssignments: { none: { isActive: true } } },
    });
    return {
      dormitories: dorms,
      totals: {
        awaitingPlacement,
        dormitories: dorms.length,
        beds: dorms.reduce((sum, d) => sum + d.totalBeds, 0),
        occupied: dorms.reduce((sum, d) => sum + d.occupiedBeds, 0),
        studentsAway: away,
        pendingLeaves,
        missingRollCalls: Math.max(0, rosterSize - markedToday),
        expectedReturnsToday,
      },
    };
  }

  async listDormitories(user?: RequestUser) {
    const staffFilter = this.isDormStaff(user)
      ? { staffAssignments: { some: { staffUserId: user!.id, isActive: true } } }
      : {};
    const rows = await this.prisma.dormitory.findMany({
      where: { ...schoolScopeFilter(user), ...staffFilter, isActive: true },
      include: {
        _count: { select: { beds: true, staffAssignments: true } },
        studentAssignments: { where: { isActive: true }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ studentAssignments, ...dorm }) => ({
      ...dorm,
      occupiedBeds: studentAssignments.length,
      availableBeds: Math.max(0, dorm.totalBeds - studentAssignments.length),
    }));
  }

  private async uniqueDormitoryCode(schoolId: string, name: string, wanted?: string) {
    const base = (wanted?.trim() || name.trim().split(/\s+/).map((w) => w[0]).join('') || name.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10) || 'DORM';
    let code = base;
    for (let n = 2; await this.prisma.dormitory.findUnique({ where: { schoolId_code: { schoolId, code } } }); n++) {
      if (wanted?.trim()) throw new ConflictException(`A dormitory with code ${base} already exists in this school`);
      code = `${base}${n}`;
    }
    return code;
  }

  async createDormitory(dto: CreateDormitoryDto, actorId: string, user?: RequestUser) {
    const schoolId = requireWriteSchoolId(user, 'dormitory');
    const name = dto.name.trim();
    const code = await this.uniqueDormitoryCode(schoolId, name, dto.code);
    const staff = [...new Map((dto.staff ?? []).map((s) => [s.staffUserId, s])).values()];
    return this.prisma.dormitory.create({
      data: {
        schoolId,
        name,
        code,
        gender: dto.gender,
        totalBeds: dto.totalBeds,
        notes: dto.notes,
        eligibilityNotes: dto.eligibilityNotes,
        createdBy: actorId,
        beds: dto.totalBeds > 0 ? {
          create: Array.from({ length: dto.totalBeds }, (_, index) => ({ label: `B${String(index + 1).padStart(3, '0')}` })),
        } : undefined,
        staffAssignments: staff.length ? { create: staff.map((s) => ({ staffUserId: s.staffUserId, staffRole: s.staffRole, assignedBy: actorId })) } : undefined,
      },
      include: { beds: true, staffAssignments: true },
    });
  }

  /** Boarders who have no dormitory yet: the matron's and patron's to-do list. */
  async awaiting(user?: RequestUser) {
    const students = await this.prisma.student.findMany({
      where: {
        ...schoolScopeFilter(user),
        status: StudentStatus.ACTIVE,
        residenceType: ResidenceType.BOARDING,
        dormitoryAssignments: { none: { isActive: true } },
      },
      select: {
        id: true, firstName: true, lastName: true, registrationNumber: true, gender: true, schoolId: true, admissionDate: true,
        enrolments: { where: { isActive: true }, take: 1, select: { class: { select: { name: true } } } },
      },
      orderBy: [{ admissionDate: 'desc' }, { firstName: 'asc' }],
      take: 500,
    });
    const dormitories = (await this.listDormitories(user)).map((d) => ({
      id: d.id, name: d.name, code: d.code, gender: d.gender, schoolId: d.schoolId, totalBeds: d.totalBeds, occupiedBeds: d.occupiedBeds, availableBeds: d.availableBeds,
    }));
    return {
      total: students.length,
      students: students.map(({ enrolments, ...s }) => ({ ...s, className: enrolments[0]?.class?.name ?? null })),
      dormitories,
    };
  }

  async updateDormitory(id: string, dto: UpdateDormitoryDto, user?: RequestUser) {
    const dorm = await this.dormitory(id, user);
    const occupied = await this.prisma.dormitoryStudentAssignment.count({ where: { dormitoryId: id, isActive: true } });
    if (dto.totalBeds != null && dto.totalBeds < occupied) {
      throw new BadRequestException(`Total beds cannot be below the ${occupied} occupied beds`);
    }
    if (dto.gender && dto.gender !== dorm.gender) {
      const mismatch = await this.prisma.dormitoryStudentAssignment.findFirst({
        where: { dormitoryId: id, isActive: true, student: { gender: { not: dto.gender } } },
      });
      if (mismatch) throw new BadRequestException('Cannot change dormitory gender while students of another gender are assigned. Move them first.');
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.totalBeds != null && dto.totalBeds !== dorm.totalBeds) {
        const activeBeds = await tx.dormitoryBed.findMany({ where: { dormitoryId: id, status: { not: BedStatus.INACTIVE } }, orderBy: { label: 'desc' } });
        if (dto.totalBeds < activeBeds.length) {
          const removable = activeBeds.filter((bed) => bed.status !== BedStatus.OCCUPIED).slice(0, activeBeds.length - dto.totalBeds);
          if (removable.length !== activeBeds.length - dto.totalBeds) throw new BadRequestException('Occupied beds cannot be removed from capacity');
          await tx.dormitoryBed.updateMany({ where: { id: { in: removable.map((bed) => bed.id) } }, data: { status: BedStatus.INACTIVE } });
        } else if (dto.totalBeds > activeBeds.length) {
          const needed = dto.totalBeds - activeBeds.length;
          const inactive = await tx.dormitoryBed.findMany({ where: { dormitoryId: id, status: BedStatus.INACTIVE }, take: needed, orderBy: { label: 'asc' } });
          if (inactive.length) await tx.dormitoryBed.updateMany({ where: { id: { in: inactive.map((bed) => bed.id) } }, data: { status: BedStatus.AVAILABLE } });
          const remaining = needed - inactive.length;
          if (remaining > 0) {
            const existing = await tx.dormitoryBed.count({ where: { dormitoryId: id } });
            await tx.dormitoryBed.createMany({ data: Array.from({ length: remaining }, (_, index) => ({ dormitoryId: id, label: `B${String(existing + index + 1).padStart(3, '0')}` })), skipDuplicates: true });
          }
        }
      }
      return tx.dormitory.update({ where: { id }, data: dto });
    });
  }

  async detail(id: string, user?: RequestUser) {
    await this.dormitory(id, user);
    return this.prisma.dormitory.findUnique({
      where: { id },
      include: {
        beds: { orderBy: { label: 'asc' } },
        staffAssignments: { where: { isActive: true }, orderBy: { assignedAt: 'asc' } },
        studentAssignments: {
          where: { isActive: true },
          include: {
            bed: true,
            student: { include: { enrolments: { where: { isActive: true }, include: { class: true }, take: 1 } } },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });
  }

  async assignStaff(dormitoryId: string, dto: AssignDormitoryStaffDto, actorId: string, user?: RequestUser) {
    await this.dormitory(dormitoryId, user);
    return this.prisma.dormitoryStaffAssignment.upsert({
      where: { dormitoryId_staffUserId: { dormitoryId, staffUserId: dto.staffUserId } },
      create: { dormitoryId, ...dto, assignedBy: actorId },
      update: { staffRole: dto.staffRole, isActive: true, assignedBy: actorId, endedAt: null },
    });
  }

  async unassignStaff(dormitoryId: string, staffUserId: string, user?: RequestUser) {
    await this.dormitory(dormitoryId, user);
    const assignment = await this.prisma.dormitoryStaffAssignment.findUnique({ where: { dormitoryId_staffUserId: { dormitoryId, staffUserId } } });
    if (!assignment || !assignment.isActive) throw new NotFoundException('Active staff assignment not found');
    return this.prisma.dormitoryStaffAssignment.update({ where: { id: assignment.id }, data: { isActive: false, endedAt: new Date() } });
  }

  async assignStudent(dormitoryId: string, dto: AssignDormitoryStudentDto, actorId: string, user?: RequestUser) {
    const dorm = await this.dormitory(dormitoryId, user);
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolInScope(user, student.schoolId);
    if (student.schoolId !== dorm.schoolId) throw new BadRequestException('Student and dormitory must belong to the same school');
    if (student.residenceType !== ResidenceType.BOARDING) throw new BadRequestException('Only students classified as Boarding may be assigned to a dormitory');
    if (!dorm.gender) throw new BadRequestException('Set this dormitory’s boys/girls designation before placing students');
    if (student.gender !== dorm.gender) throw new BadRequestException('Student gender does not match this dormitory’s boys/girls designation');
    const existing = await this.prisma.dormitoryStudentAssignment.findFirst({ where: { studentId: dto.studentId, isActive: true } });
    if (existing) throw new ConflictException('Student already has an active dormitory assignment');
    const occupancy = await this.prisma.dormitoryStudentAssignment.count({ where: { dormitoryId, isActive: true } });
    if (occupancy >= dorm.totalBeds) throw new ConflictException('Dormitory is at full capacity');
    if (dto.bedId) {
      const bed = await this.prisma.dormitoryBed.findUnique({ where: { id: dto.bedId } });
      if (!bed || bed.dormitoryId !== dormitoryId) throw new BadRequestException('Bed does not belong to this dormitory');
      if (bed.status !== BedStatus.AVAILABLE) throw new ConflictException('Bed is not available');
    }
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.dormitoryStudentAssignment.create({ data: { dormitoryId, studentId: dto.studentId, bedId: dto.bedId, assignedBy: actorId } });
      if (dto.bedId) await tx.dormitoryBed.update({ where: { id: dto.bedId }, data: { status: BedStatus.OCCUPIED } });
      return assignment;
    });
  }

  async unassignStudent(dormitoryId: string, studentId: string, user?: RequestUser) {
    await this.dormitory(dormitoryId, user);
    const assignment = await this.prisma.dormitoryStudentAssignment.findFirst({ where: { dormitoryId, studentId, isActive: true } });
    if (!assignment) throw new NotFoundException('Active student assignment not found');
    const activeLeave = await this.prisma.studentLeave.findFirst({ where: { studentId, status: { in: ACTIVE_LEAVE } } });
    if (activeLeave) throw new ConflictException('Student cannot be removed while leave is active');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.dormitoryStudentAssignment.update({ where: { id: assignment.id }, data: { isActive: false, endedAt: new Date() } });
      if (assignment.bedId) await tx.dormitoryBed.update({ where: { id: assignment.bedId }, data: { status: BedStatus.AVAILABLE } });
      return result;
    });
  }

  async updateBed(dormitoryId: string, bedId: string, status: BedStatus, user?: RequestUser) {
    await this.dormitory(dormitoryId, user);
    const bed = await this.prisma.dormitoryBed.findUnique({ where: { id: bedId } });
    if (!bed || bed.dormitoryId !== dormitoryId) throw new NotFoundException('Bed not found in this dormitory');
    const activeAssignment = await this.prisma.dormitoryStudentAssignment.findFirst({ where: { bedId, isActive: true } });
    if (activeAssignment && status !== BedStatus.OCCUPIED) throw new ConflictException('An occupied bed cannot be changed or deactivated');
    if (!activeAssignment && status === BedStatus.OCCUPIED) throw new BadRequestException('Assign a student to occupy this bed');
    return this.prisma.dormitoryBed.update({ where: { id: bedId }, data: { status } });
  }

  async recordRollCall(dormitoryId: string, dto: RecordRollCallDto, actorId: string, user?: RequestUser) {
    await this.dormitory(dormitoryId, user);
    const today = new Date().toISOString().slice(0, 10);
    const requestedDate = dto.date.slice(0, 10);
    if (requestedDate !== today) {
      throw new BadRequestException('Roll call can only be recorded or edited for the current date');
    }
    const roster = await this.prisma.dormitoryStudentAssignment.findMany({ where: { dormitoryId, isActive: true }, select: { studentId: true } });
    const allowed = new Set(roster.map((row) => row.studentId));
    const invalid = dto.records.find((row) => !allowed.has(row.studentId));
    if (invalid) throw new BadRequestException('Roll call contains a student outside this dormitory');
    const date = new Date(dto.date);
    return this.prisma.$transaction(dto.records.map((record) => this.prisma.hostelRollCall.upsert({
      where: { dormitoryId_studentId_date_session: { dormitoryId, studentId: record.studentId, date, session: dto.session } },
      create: { dormitoryId, studentId: record.studentId, date, session: dto.session, status: record.status, note: record.note, markedBy: actorId },
      update: { status: record.status, note: record.note, markedBy: actorId, markedAt: new Date() },
    })));
  }

  async listRollCalls(user?: RequestUser, dormitoryId?: string) {
    if (dormitoryId) await this.dormitory(dormitoryId, user);
    const dorms = dormitoryId ? [{ id: dormitoryId }] : await this.listDormitories(user);
    const rows = await this.prisma.hostelRollCall.findMany({
      where: { dormitoryId: { in: dorms.map((dorm) => dorm.id) } },
      include: { dormitory: { select: { id: true, name: true, code: true, schoolId: true } } },
      orderBy: [{ date: 'desc' }, { session: 'asc' }, { markedAt: 'desc' }],
    });
    const grouped = new Map<string, {
      dormitoryId: string; dormitory: { id: string; name: string; code: string; schoolId: string };
      date: Date; session: RollCallSession; total: number; present: number; absent: number; onLeave: number; excused: number; lastMarkedAt: Date;
    }>();
    for (const row of rows) {
      const key = `${row.dormitoryId}:${row.date.toISOString().slice(0, 10)}:${row.session}`;
      const current = grouped.get(key) ?? {
        dormitoryId: row.dormitoryId, dormitory: row.dormitory, date: row.date, session: row.session,
        total: 0, present: 0, absent: 0, onLeave: 0, excused: 0, lastMarkedAt: row.markedAt,
      };
      current.total += 1;
      if (row.status === 'PRESENT') current.present += 1;
      if (row.status === 'ABSENT') current.absent += 1;
      if (row.status === 'ON_LEAVE') current.onLeave += 1;
      if (row.status === 'EXCUSED') current.excused += 1;
      if (row.markedAt > current.lastMarkedAt) current.lastMarkedAt = row.markedAt;
      grouped.set(key, current);
    }
    return Array.from(grouped.values());
  }

  async rollCallDetail(dormitoryId: string, dateText: string, session: RollCallSession, user?: RequestUser) {
    const dorm = await this.dormitory(dormitoryId, user);
    const date = new Date(`${dateText.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid roll-call date');
    const records = await this.prisma.hostelRollCall.findMany({
      where: { dormitoryId, date, session },
      include: { student: { select: { id: true, firstName: true, lastName: true, registrationNumber: true } } },
      orderBy: { student: { firstName: 'asc' } },
    });
    return { dormitory: { id: dorm.id, name: dorm.name, code: dorm.code, totalBeds: dorm.totalBeds }, date, session, records };
  }

  async listLeaves(user?: RequestUser, status?: HostelLeaveStatus) {
    const dorms = await this.listDormitories(user);
    return this.prisma.studentLeave.findMany({
      where: { dormitoryId: { in: dorms.map((d) => d.id) }, ...(status ? { status } : {}) },
      include: { dormitory: true, student: true, term: true, events: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLeave(dto: CreateStudentLeaveDto, actorId: string, user?: RequestUser) {
    const dorm = await this.dormitory(dto.dormitoryId, user);
    const assignment = await this.prisma.dormitoryStudentAssignment.findFirst({ where: { dormitoryId: dto.dormitoryId, studentId: dto.studentId, isActive: true } });
    if (!assignment) throw new BadRequestException('Student is not active in this dormitory');
    const term = await this.prisma.term.findUnique({ where: { id: dto.termId } });
    if (!term || !term.isCurrent) throw new BadRequestException('Leave must be recorded against an active term');
    const departureAt = new Date(dto.departureAt);
    const expectedReturnAt = new Date(dto.expectedReturnAt);
    if (expectedReturnAt <= departureAt) throw new BadRequestException('Expected return must be after departure');
    const active = await this.prisma.studentLeave.findFirst({ where: { studentId: dto.studentId, status: { in: ACTIVE_LEAVE } } });
    if (active) throw new ConflictException('Student already has an active leave record');
    return this.prisma.studentLeave.create({
      data: {
        ...dto,
        schoolId: dorm.schoolId,
        departureAt,
        expectedReturnAt,
        requestedBy: actorId,
        events: { create: { toStatus: HostelLeaveStatus.REQUESTED, actorId } },
      },
      include: { events: true },
    });
  }

  async transitionLeave(id: string, dto: TransitionStudentLeaveDto, actorId: string, user?: RequestUser) {
    const leave = await this.prisma.studentLeave.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Leave record not found');
    await this.dormitory(leave.dormitoryId, user);
    if (!LEAVE_TRANSITIONS[leave.status].includes(dto.status)) throw new BadRequestException(`Cannot move leave from ${leave.status} to ${dto.status}`);
    const actorFields: Prisma.StudentLeaveUpdateInput = dto.status === HostelLeaveStatus.APPROVED || dto.status === HostelLeaveStatus.REJECTED
      ? { decidedBy: actorId, decisionNote: dto.note }
      : dto.status === HostelLeaveStatus.DEPARTED
        ? { departedBy: actorId }
        : dto.status === HostelLeaveStatus.RETURNED
          ? { returnedBy: actorId, actualReturnAt: dto.actualReturnAt ? new Date(dto.actualReturnAt) : new Date() }
          : {};
    return this.prisma.studentLeave.update({
      where: { id },
      data: {
        status: dto.status,
        ...actorFields,
        events: { create: { fromStatus: leave.status, toStatus: dto.status, note: dto.note, actorId } },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
