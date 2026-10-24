import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma';
import { assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthClientService } from '../admissions/auth-client.service';
import { ExecuteStudentLifecycleDto, StudentLifecyclePreviewDto, type StudentLifecycleAction } from './dto/student-lifecycle.dto';

type DependencyUsage = {
  source: 'academics' | 'finance' | 'elearning';
  protectedStudentIds: string[];
  counts: Record<string, number>;
  classRecords?: Record<string, number>;
};

type LifecyclePreview = {
  class: { id: string; name: string; schoolId: string | null; schoolName: string | null };
  action: StudentLifecycleAction;
  candidateStudents: Array<{ id: string; name: string; registrationNumber: string }>;
  eligibleStudentIds: string[];
  blockedStudents: Array<{ id: string; name: string; reasons: string[] }>;
  localCounts: Record<string, number>;
  dependencyUsage: DependencyUsage[];
  classBlockers: string[];
  canExecute: boolean;
  confirmationText: string;
  fingerprint: string;
};

@Injectable()
export class StudentLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authClient: AuthClientService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async preview(dto: StudentLifecyclePreviewDto, user?: RequestUser): Promise<LifecyclePreview> {
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      include: { school: { select: { name: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    assertSchoolInScope(user, cls.schoolId);

    const candidateIds = await this.resolveCandidateIds(dto, cls.id);
    if ((dto.action === 'UNENROL_STUDENTS' || dto.action === 'DELETE_STUDENTS') && !candidateIds.length) {
      throw new BadRequestException('Select at least one current student in this class.');
    }

    const students = candidateIds.length
      ? await this.prisma.student.findMany({
        where: { id: { in: candidateIds } },
        select: {
          id: true, firstName: true, middleName: true, lastName: true, registrationNumber: true,
          schoolId: true,
          enrolments: { where: { isActive: true }, select: { classId: true } },
        },
      })
      : [];
    if (students.length !== candidateIds.length) throw new BadRequestException('One or more selected students no longer exist. Refresh and review the roster.');
    if (students.some((student) => student.schoolId !== cls.schoolId)) throw new BadRequestException('A selected student belongs to a different school. Refresh the roster.');

    const local = await this.localUsage(candidateIds, cls.id);
    const dependencies = await this.dependencyUsage(candidateIds, cls.id);
    const externalProtected = new Map<string, string[]>();
    for (const usage of dependencies) {
      for (const id of usage.protectedStudentIds) {
        externalProtected.set(id, [...(externalProtected.get(id) ?? []), `${usage.source} history`]);
      }
    }

    const blockedStudents = students.flatMap((student) => {
      const reasons: string[] = [];
      if (dto.action !== 'UNENROL_STUDENTS') {
        if ((local.attendanceByStudent[student.id] ?? 0) > 0) reasons.push('attendance records');
        if ((local.disciplineByStudent[student.id] ?? 0) > 0) reasons.push('discipline records');
        if ((local.performanceByStudent[student.id] ?? 0) > 0) reasons.push('performance history');
        if ((local.otherActiveEnrolmentsByStudent[student.id] ?? 0) > 0) reasons.push('an active enrolment in another class');
        reasons.push(...(externalProtected.get(student.id) ?? []));
      }
      return reasons.length ? [{
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        reasons,
      }] : [];
    });

    const classBlockers: string[] = [];
    if (dto.action === 'DELETE_CLASS_AND_STUDENTS' || dto.action === 'DELETE_EMPTY_CLASS') {
      if (dto.action === 'DELETE_EMPTY_CLASS' && candidateIds.length) classBlockers.push(`${candidateIds.length} student record(s) are linked to this class`);
      if (local.classApplicants > 0) classBlockers.push(`${local.classApplicants} admissions applicant(s) reference this class`);
      for (const usage of dependencies) {
        for (const [label, count] of Object.entries(usage.classRecords ?? {})) {
          if (count > 0) classBlockers.push(`${count} ${usage.source} ${label}`);
        }
      }
    }

    const canExecute = dto.action === 'UNENROL_STUDENTS'
      ? candidateIds.length > 0
      : blockedStudents.length === 0 && classBlockers.length === 0;
    const confirmationText = dto.action === 'UNENROL_STUDENTS'
      ? `REMOVE ${candidateIds.length} FROM CLASS`
      : dto.action === 'DELETE_STUDENTS'
        ? `DELETE ${candidateIds.length} STUDENTS`
        : `DELETE CLASS ${cls.name.toUpperCase()}`;
    const fingerprint = this.fingerprint({
      classId: dto.classId,
      action: dto.action,
      studentIds: [...(dto.studentIds ?? [])].sort(),
      allClassStudents: Boolean(dto.allClassStudents),
      candidateIds: [...candidateIds].sort(),
      blockedStudents,
      classBlockers,
      local,
      dependencies,
    });

    return {
      class: { id: cls.id, name: cls.name, schoolId: cls.schoolId, schoolName: cls.school?.name ?? null },
      action: dto.action,
      candidateStudents: students.map((student) => ({
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        registrationNumber: student.registrationNumber,
      })),
      eligibleStudentIds: students.filter((student) => !blockedStudents.some((blocked) => blocked.id === student.id)).map((student) => student.id),
      blockedStudents,
      localCounts: local.counts,
      dependencyUsage: dependencies,
      classBlockers,
      canExecute,
      confirmationText,
      fingerprint,
    };
  }

  async execute(dto: ExecuteStudentLifecycleDto, user?: RequestUser) {
    if (!user) throw new BadRequestException('An authenticated administrator is required.');
    if (dto.action !== 'UNENROL_STUDENTS' && !['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only a Super Admin or System Admin can permanently remove student or class records.');
    }
    const preview = await this.preview(dto, user);
    if (!preview.canExecute) throw new BadRequestException('This operation is blocked by protected records. Use the reversible class cleanup option or resolve the listed records.');
    if (dto.confirmation.trim().toUpperCase() !== preview.confirmationText) throw new BadRequestException(`Type exactly: ${preview.confirmationText}`);
    if (dto.fingerprint !== preview.fingerprint) throw new BadRequestException('The impact preview is no longer current. Review the updated impact before continuing.');

    if (dto.action === 'UNENROL_STUDENTS') {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.enrolment.updateMany({
          where: { classId: dto.classId, studentId: { in: preview.eligibleStudentIds }, isActive: true },
          data: { isActive: false },
        });
        const operation = await tx.studentLifecycleOperation.create({
          data: {
            schoolId: preview.class.schoolId,
            classId: dto.classId,
            action: dto.action,
            actorId: user.id,
            reason: dto.reason.trim(),
            targetCount: preview.eligibleStudentIds.length,
            impact: preview as unknown as Prisma.InputJsonValue,
            outcome: { unenrolled: updated.count } as Prisma.InputJsonValue,
          },
        });
        return { unenrolled: updated.count, operationId: operation.id };
      });
      await this.redis.del(`class:${dto.classId}:student-ids`);
      return { ...result, deletedStudents: 0, deletedClass: false, accountCleanup: [] };
    }

    const accountIds = await this.deleteStudentRecords(preview.eligibleStudentIds, dto.classId, dto.action === 'DELETE_CLASS_AND_STUDENTS', user, dto.reason.trim(), preview);
    const accountCleanup = dto.deleteLinkedAccounts === false
      ? []
      : await Promise.all(accountIds.map(async (id) => {
        try { await this.authClient.deleteAccount(id); return { userId: id, deleted: true }; }
        catch (error) { return { userId: id, deleted: false, error: (error as Error).message }; }
      }));
    return {
      deletedStudents: preview.eligibleStudentIds.length,
      deletedClass: dto.action === 'DELETE_CLASS_AND_STUDENTS' || dto.action === 'DELETE_EMPTY_CLASS',
      accountCleanup,
    };
  }

  private async resolveCandidateIds(dto: StudentLifecyclePreviewDto, classId: string): Promise<string[]> {
    if (dto.action === 'DELETE_CLASS_AND_STUDENTS') {
      const enrolments = await this.prisma.enrolment.findMany({ where: { classId }, distinct: ['studentId'], select: { studentId: true } });
      return enrolments.map((item) => item.studentId);
    }
    if (dto.action === 'DELETE_EMPTY_CLASS') return [];
    if (dto.allClassStudents) {
      const enrolments = await this.prisma.enrolment.findMany({ where: { classId, isActive: true }, distinct: ['studentId'], select: { studentId: true } });
      return enrolments.map((item) => item.studentId);
    }
    const requested = [...new Set(dto.studentIds ?? [])];
    if (!requested.length) return [];
    const enrolled = await this.prisma.enrolment.findMany({
      where: { classId, studentId: { in: requested }, isActive: true }, select: { studentId: true },
    });
    if (enrolled.length !== requested.length) throw new BadRequestException('Only students currently enrolled in this class can be selected. Refresh and try again.');
    return requested;
  }

  private async localUsage(studentIds: string[], classId: string) {
    const byStudent = (rows: Array<{ studentId: string }>) => rows.reduce<Record<string, number>>((result, row) => {
      result[row.studentId] = (result[row.studentId] ?? 0) + 1;
      return result;
    }, {});
    const ids = studentIds.length ? studentIds : ['__none__'];
    const [attendance, discipline, snapshots, trends, alerts, pairings, otherEnrolments, classApplicants] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
      this.prisma.disciplineRecord.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
      this.prisma.performanceSnapshot.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
      this.prisma.performanceTrend.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
      this.prisma.performanceAlert.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
      this.prisma.peerPairing.findMany({ where: { OR: [{ studentId: { in: ids } }, { peerId: { in: ids } }] }, select: { studentId: true, peerId: true } }),
      this.prisma.enrolment.findMany({ where: { studentId: { in: ids }, isActive: true, classId: { not: classId } }, select: { studentId: true } }),
      this.prisma.applicant.count({ where: { prospectiveClassId: classId } }),
    ]);
    const performanceByStudent = byStudent([...snapshots, ...trends, ...alerts, ...pairings.flatMap((pairing) => [{ studentId: pairing.studentId }, { studentId: pairing.peerId }])]);
    return {
      attendanceByStudent: byStudent(attendance), disciplineByStudent: byStudent(discipline), performanceByStudent,
      otherActiveEnrolmentsByStudent: byStudent(otherEnrolments), classApplicants,
      counts: { attendance: attendance.length, discipline: discipline.length, performanceSnapshots: snapshots.length, performanceTrends: trends.length, performanceAlerts: alerts.length, peerPairings: pairings.length, otherActiveEnrolments: otherEnrolments.length, applicants: classApplicants },
    };
  }

  private async dependencyUsage(studentIds: string[], classId: string): Promise<DependencyUsage[]> {
    const query = new URLSearchParams({ studentIds: studentIds.join(','), classId }).toString();
    return Promise.all([
      this.fetchUsage('academics', this.config.get<string>('ACADEMIC_SERVICE_URL') || 'http://localhost:3003', `/academics/internal/lifecycle-usage?${query}`),
      this.fetchUsage('finance', this.config.get<string>('FINANCE_SERVICE_URL') || 'http://localhost:3004', `/finance/internal/lifecycle-usage?${query}`),
      this.fetchUsage('elearning', this.config.get<string>('ELEARNING_SERVICE_URL') || 'http://localhost:3007', `/elearning/internal/lifecycle-usage?${query}`),
    ]);
  }

  private async fetchUsage(source: DependencyUsage['source'], base: string, path: string): Promise<DependencyUsage> {
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/api/v1${path}`, { headers: { 'x-internal-api-key': this.config.get<string>('INTERNAL_API_KEY') || '' } });
      if (!response.ok) throw new Error(`returned ${response.status}`);
      const body = await response.json() as { data?: Partial<DependencyUsage> } | Partial<DependencyUsage>;
      const value = (body && typeof body === 'object' && 'data' in body ? body.data : body) as Partial<DependencyUsage> | undefined;
      return { source, protectedStudentIds: value?.protectedStudentIds ?? [], counts: value?.counts ?? {}, classRecords: value?.classRecords ?? {} };
    } catch (error) {
      throw new ServiceUnavailableException(`Cannot verify ${source} records. Hard deletion is unavailable until all services are reachable.`);
    }
  }

  private async deleteStudentRecords(
    studentIds: string[], classId: string, deleteClass: boolean, user: RequestUser, reason: string, preview: LifecyclePreview,
  ): Promise<string[]> {
    const accountIds = await this.prisma.$transaction(async (tx) => {
      const students = await tx.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, authUserId: true } });
      const guardianLinks = await tx.studentGuardianLink.findMany({ where: { studentId: { in: studentIds } }, select: { guardianId: true } });
      const guardianIds = [...new Set(guardianLinks.map((link) => link.guardianId))];
      await tx.performanceAlert.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.peerPairing.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { peerId: { in: studentIds } }] } });
      await tx.performanceSnapshot.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.performanceTrend.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.attendanceRecord.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.disciplineRecord.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.studentGuardianLink.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.enrolment.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });
      const orphanedGuardians = guardianIds.length
        ? await tx.guardian.findMany({ where: { id: { in: guardianIds }, studentLinks: { none: {} } }, select: { id: true, authUserId: true } })
        : [];
      if (orphanedGuardians.length) await tx.guardian.deleteMany({ where: { id: { in: orphanedGuardians.map((guardian) => guardian.id) } } });
      if (deleteClass) await tx.class.delete({ where: { id: classId } });
      await tx.studentLifecycleOperation.create({
        data: {
          schoolId: preview.class.schoolId,
          classId,
          action: preview.action,
          actorId: user.id,
          reason,
          targetCount: studentIds.length,
          impact: preview as unknown as Prisma.InputJsonValue,
          outcome: { deletedStudents: studentIds.length, deletedClass: deleteClass, orphanedGuardians: orphanedGuardians.length } as Prisma.InputJsonValue,
        },
      });
      return [...students.map((student) => student.authUserId), ...orphanedGuardians.map((guardian) => guardian.authUserId)];
    });
    await this.redis.del(`class:${classId}:student-ids`, ...studentIds.flatMap((id) => [`student:${id}:profile`]));
    return accountIds;
  }

  private fingerprint(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
