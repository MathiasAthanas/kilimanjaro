import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BedStatus, HostelLeaveStatus, Prisma, ResidenceChangeStatus, ResidenceType, StudentStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { BulkClassifyDto, ChangeResidenceDto, ResidenceStudentsQueryDto } from './residence.dto';

const OPEN_LEAVE = [HostelLeaveStatus.REQUESTED, HostelLeaveStatus.APPROVED];

export type ResidenceSource = 'CHANGE' | 'BULK' | 'EDIT' | 'ADMISSION' | 'SCHEDULE';

function label(type: ResidenceType | null | undefined): string {
  return type === ResidenceType.BOARDING ? 'Boarding' : type === ResidenceType.DAY_SCHOLAR ? 'Day Scholar' : 'unclassified';
}

@Injectable()
export class ResidenceService {
  private readonly logger = new Logger(ResidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  private async forget(student: { id: string; registrationNumber: string }) {
    try {
      await this.redis.del(`student:${student.id}:profile`, `student:reg:${student.registrationNumber}`);
    } catch {
      // the cache is best-effort
    }
  }

  /** The next term that has not started yet (the school's own term first, then a group-wide one). */
  private async nextTerm(schoolId: string | null) {
    const terms = await this.prisma.term.findMany({
      where: { startDate: { gt: new Date() }, ...(schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {}) },
      orderBy: { startDate: 'asc' },
      take: 5,
    });
    return terms.find((t) => t.schoolId === schoolId) ?? terms[0] ?? null;
  }

  /**
   * Free the student's bed and end the dormitory assignment. Open (not yet departed) leave is cancelled;
   * a student who is currently away must be recorded as returned first.
   */
  private async releaseDormitory(tx: Prisma.TransactionClient, studentId: string, reason: string): Promise<string | null> {
    const assignment = await tx.dormitoryStudentAssignment.findFirst({ where: { studentId, isActive: true } });
    if (!assignment) return null;
    const away = await tx.studentLeave.findFirst({ where: { studentId, status: HostelLeaveStatus.DEPARTED } });
    if (away) throw new ConflictException('This student is currently away on leave. Record their return in the dormitory first.');
    const open = await tx.studentLeave.findMany({ where: { studentId, status: { in: OPEN_LEAVE } }, select: { id: true, status: true } });
    for (const leave of open) {
      await tx.studentLeave.update({
        where: { id: leave.id },
        data: { status: HostelLeaveStatus.CANCELLED, events: { create: { fromStatus: leave.status, toStatus: HostelLeaveStatus.CANCELLED, note: reason, actorId: 'system' } } },
      });
    }
    await tx.dormitoryStudentAssignment.update({ where: { id: assignment.id }, data: { isActive: false, endedAt: new Date() } });
    if (assignment.bedId) await tx.dormitoryBed.update({ where: { id: assignment.bedId }, data: { status: BedStatus.AVAILABLE } });
    return assignment.dormitoryId;
  }

  /** Apply one classification right now: update the student, free any bed, write history, tell finance. */
  async applyNow(
    studentId: string,
    toType: ResidenceType,
    meta: { source: ResidenceSource; reason?: string | null; actorId: string; actorRole?: string | null; effectiveTermId?: string | null; scheduledId?: string | null },
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    const fromType = student.residenceType;
    if (fromType === toType) {
      if (meta.scheduledId) {
        await this.prisma.residenceChange.update({ where: { id: meta.scheduledId }, data: { status: ResidenceChangeStatus.CANCELLED, appliedAt: new Date() } });
      }
      return { student, change: null, unchanged: true };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let releasedDormitoryId: string | null = null;
      if (toType === ResidenceType.DAY_SCHOLAR) releasedDormitoryId = await this.releaseDormitory(tx, studentId, 'Student became a day scholar');
      const updated = await tx.student.update({ where: { id: studentId }, data: { residenceType: toType } });
      const appliedAt = new Date();
      const change = meta.scheduledId
        ? await tx.residenceChange.update({
            where: { id: meta.scheduledId },
            data: { status: ResidenceChangeStatus.APPLIED, fromType, releasedDormitoryId, appliedAt },
          })
        : await tx.residenceChange.create({
            data: {
              studentId,
              schoolId: student.schoolId,
              fromType,
              toType,
              status: ResidenceChangeStatus.APPLIED,
              effectiveTermId: meta.effectiveTermId ?? null,
              reason: meta.reason ?? null,
              releasedDormitoryId,
              source: meta.source,
              changedBy: meta.actorId,
              changedByRole: meta.actorRole ?? null,
              appliedAt,
            },
          });
      return { updated, change };
    });

    await this.forget(student);
    try {
      await this.rabbitMq.publish('student.residence.changed', {
        studentId,
        schoolId: student.schoolId,
        previousResidenceType: fromType,
        residenceType: toType,
        effectiveTermId: meta.effectiveTermId ?? null,
        changedBy: meta.actorId,
        changedAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`Could not publish residence change for ${studentId}: ${(err as Error)?.message}`);
    }
    return { student: result.updated, change: result.change, unchanged: false };
  }

  /** The guided "Change residence" action. */
  async change(studentId: string, dto: ChangeResidenceDto, user?: RequestUser) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolInScope(user, student.schoolId ?? null);
    if (student.status !== StudentStatus.ACTIVE) throw new BadRequestException('Only active students can change residence');
    const actorId = user?.id || 'system';

    if (dto.effective === 'NEXT_TERM') {
      if (student.residenceType === dto.residenceType) {
        throw new BadRequestException(`The student is already classified as ${label(dto.residenceType)}`);
      }
      const term = await this.nextTerm(student.schoolId ?? null);
      if (!term) throw new BadRequestException('No upcoming term is set up yet. Choose "Now", or create the next term first.');
      return this.prisma.$transaction(async (tx) => {
        await tx.residenceChange.updateMany({ where: { studentId, status: ResidenceChangeStatus.SCHEDULED }, data: { status: ResidenceChangeStatus.CANCELLED } });
        const scheduled = await tx.residenceChange.create({
          data: {
            studentId,
            schoolId: student.schoolId,
            fromType: student.residenceType,
            toType: dto.residenceType,
            status: ResidenceChangeStatus.SCHEDULED,
            effectiveTermId: term.id,
            effectiveFrom: term.startDate,
            reason: dto.reason ?? null,
            source: 'CHANGE',
            changedBy: actorId,
            changedByRole: user?.role ?? null,
          },
        });
        return { applied: false, scheduled, effectiveTerm: { id: term.id, name: term.name, startDate: term.startDate } };
      });
    }

    if (student.residenceType === dto.residenceType) throw new BadRequestException(`The student is already classified as ${label(dto.residenceType)}`);
    // Applying now supersedes any pending scheduled change for this student.
    await this.prisma.residenceChange.updateMany({ where: { studentId, status: ResidenceChangeStatus.SCHEDULED }, data: { status: ResidenceChangeStatus.CANCELLED } });
    const result = await this.applyNow(studentId, dto.residenceType, { source: 'CHANGE', reason: dto.reason, actorId, actorRole: user?.role });
    return { applied: true, change: result.change, student: result.student, releasedDormitoryId: result.change?.releasedDormitoryId ?? null };
  }

  async cancelScheduled(changeId: string, user?: RequestUser) {
    const change = await this.prisma.residenceChange.findUnique({ where: { id: changeId } });
    if (!change || change.status !== ResidenceChangeStatus.SCHEDULED) throw new NotFoundException('No scheduled change found');
    assertSchoolInScope(user, change.schoolId ?? null);
    return this.prisma.residenceChange.update({ where: { id: changeId }, data: { status: ResidenceChangeStatus.CANCELLED } });
  }

  async history(studentId: string, user?: RequestUser) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, residenceType: true } });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolInScope(user, student.schoolId ?? null);
    const rows = await this.prisma.residenceChange.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 50 });
    const termIds = [...new Set(rows.map((r) => r.effectiveTermId).filter(Boolean) as string[])];
    const dormIds = [...new Set(rows.map((r) => r.releasedDormitoryId).filter(Boolean) as string[])];
    const [terms, dorms] = await Promise.all([
      termIds.length ? this.prisma.term.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      dormIds.length ? this.prisma.dormitory.findMany({ where: { id: { in: dormIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const termName = new Map(terms.map((t) => [t.id, t.name]));
    const dormName = new Map(dorms.map((d) => [d.id, d.name]));
    return {
      current: student.residenceType,
      changes: rows.map((r) => ({
        ...r,
        effectiveTermName: r.effectiveTermId ? termName.get(r.effectiveTermId) ?? null : null,
        releasedDormitoryName: r.releasedDormitoryId ? dormName.get(r.releasedDormitoryId) ?? null : null,
      })),
    };
  }

  /** Classify students that have no classification yet (explicit ids, or a whole class). */
  async bulkClassify(dto: BulkClassifyDto, user?: RequestUser) {
    if (!dto.studentIds?.length && !dto.classId) throw new BadRequestException('Choose students or a class');
    let ids = dto.studentIds ?? [];
    if (!ids.length && dto.classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: dto.classId }, select: { schoolId: true } });
      if (!cls) throw new NotFoundException('Class not found');
      assertSchoolInScope(user, cls.schoolId ?? null);
      const rows = await this.prisma.student.findMany({
        where: { status: StudentStatus.ACTIVE, residenceType: null, enrolments: { some: { classId: dto.classId, isActive: true } } },
        select: { id: true },
        take: 1000,
      });
      ids = rows.map((r) => r.id);
    }
    const students = await this.prisma.student.findMany({ where: { id: { in: ids }, status: StudentStatus.ACTIVE }, select: { id: true, schoolId: true, residenceType: true } });
    for (const s of students) assertSchoolInScope(user, s.schoolId ?? null);
    const targets = students.filter((s) => s.residenceType === null);
    for (const s of targets) {
      await this.applyNow(s.id, dto.residenceType, { source: 'BULK', actorId: user?.id || 'system', actorRole: user?.role, reason: 'Classified in bulk' });
    }
    return { requested: ids.length, updated: targets.length, skipped: ids.length - targets.length };
  }

  /** Counts for the classification screen: totals, and unclassified students per class. */
  async summary(user?: RequestUser) {
    const scope = schoolScopeFilter(user);
    const students = await this.prisma.student.findMany({
      where: { ...scope, status: StudentStatus.ACTIVE },
      select: {
        residenceType: true,
        enrolments: { where: { isActive: true }, take: 1, select: { class: { select: { id: true, name: true, level: true, stream: true, schoolId: true } } } },
      },
    });
    const totals = { total: students.length, boarding: 0, dayScholar: 0, unclassified: 0 };
    type Row = { classId: string; name: string; level: number; stream: string | null; schoolId: string | null; total: number; unclassified: number; boarding: number; dayScholar: number };
    const classes = new Map<string, Row>();
    for (const s of students) {
      const cls = s.enrolments[0]?.class;
      const key = cls?.id ?? 'none';
      const row: Row = classes.get(key) ?? { classId: cls?.id ?? '', name: cls?.name ?? 'No class', level: cls?.level ?? 999, stream: cls?.stream ?? null, schoolId: cls?.schoolId ?? null, total: 0, unclassified: 0, boarding: 0, dayScholar: 0 };
      row.total++;
      if (s.residenceType === ResidenceType.BOARDING) { totals.boarding++; row.boarding++; }
      else if (s.residenceType === ResidenceType.DAY_SCHOLAR) { totals.dayScholar++; row.dayScholar++; }
      else { totals.unclassified++; row.unclassified++; }
      classes.set(key, row);
    }
    const scheduled = await this.prisma.residenceChange.count({ where: { ...scope, status: ResidenceChangeStatus.SCHEDULED } });
    return {
      totals: { ...totals, scheduled },
      classes: [...classes.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, undefined, { numeric: true })),
    };
  }

  async students(q: ResidenceStudentsQueryDto, user?: RequestUser) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const search = q.search?.trim();
    const where: Prisma.StudentWhereInput = {
      ...schoolScopeFilter(user),
      status: StudentStatus.ACTIVE,
      ...(q.status === 'UNCLASSIFIED' ? { residenceType: null } : q.status === 'BOARDING' || q.status === 'DAY_SCHOLAR' ? { residenceType: q.status as ResidenceType } : {}),
      ...(q.classId ? { enrolments: { some: { classId: q.classId, isActive: true } } } : {}),
      ...(search
        ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { registrationNumber: { contains: search, mode: 'insensitive' } }] }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        select: {
          id: true, firstName: true, lastName: true, registrationNumber: true, gender: true, residenceType: true,
          enrolments: { where: { isActive: true }, take: 1, select: { class: { select: { id: true, name: true } } } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      total,
      page,
      limit,
      items: rows.map(({ enrolments, ...r }) => ({ ...r, className: enrolments[0]?.class?.name ?? null, classId: enrolments[0]?.class?.id ?? null })),
    };
  }

  /** Scheduled changes whose term has started take effect. Runs hourly and on demand. */
  @Cron(CronExpression.EVERY_HOUR)
  async applyDueScheduled(): Promise<{ applied: number; failed: number }> {
    const due = await this.prisma.residenceChange.findMany({
      where: { status: ResidenceChangeStatus.SCHEDULED, effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'asc' },
      take: 500,
    });
    let applied = 0;
    let failed = 0;
    for (const change of due) {
      try {
        await this.applyNow(change.studentId, change.toType, {
          source: 'SCHEDULE',
          actorId: change.changedBy,
          actorRole: change.changedByRole,
          effectiveTermId: change.effectiveTermId,
          scheduledId: change.id,
        });
        applied++;
      } catch (err) {
        failed++;
        this.logger.warn(`Scheduled residence change ${change.id} could not be applied: ${(err as Error)?.message}`);
      }
    }
    return { applied, failed };
  }

  /** A student who is no longer active (transferred, graduated, withdrawn) gives their bed back. Never blocks the status change. */
  async releaseForInactiveStudent(studentId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const assignment = await tx.dormitoryStudentAssignment.findFirst({ where: { studentId, isActive: true } });
        const leaves = await tx.studentLeave.findMany({ where: { studentId, status: { in: [...OPEN_LEAVE, HostelLeaveStatus.DEPARTED] } }, select: { id: true, status: true } });
        for (const leave of leaves) {
          await tx.studentLeave.update({
            where: { id: leave.id },
            data: { status: HostelLeaveStatus.CANCELLED, events: { create: { fromStatus: leave.status, toStatus: HostelLeaveStatus.CANCELLED, note: 'Student left the school', actorId: 'system' } } },
          });
        }
        if (assignment) {
          await tx.dormitoryStudentAssignment.update({ where: { id: assignment.id }, data: { isActive: false, endedAt: new Date() } });
          if (assignment.bedId) await tx.dormitoryBed.update({ where: { id: assignment.bedId }, data: { status: BedStatus.AVAILABLE } });
        }
        await tx.residenceChange.updateMany({ where: { studentId, status: ResidenceChangeStatus.SCHEDULED }, data: { status: ResidenceChangeStatus.CANCELLED } });
      });
    } catch (err) {
      this.logger.warn(`Could not free the dormitory bed of ${studentId}: ${(err as Error)?.message}`);
    }
  }
}
