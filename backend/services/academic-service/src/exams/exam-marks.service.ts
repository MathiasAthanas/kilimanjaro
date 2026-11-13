import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus, ExemptionStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { AssessmentsService } from '../assessments/assessments.service';
import { UploadMarksDto } from './dto/upload-marks.dto';
import { resolveExpectedStudents } from './engine/expected-students';

interface RosterStudent {
  studentId: string;
  registrationNumber: string | null;
  name: string;
}

/** Why a class student is not in the marks grid, and whether the editor may bring them in. */
export type AddableReason = 'EXEMPT' | 'NOT_TAKING';
export type AddableBlock = 'CLASS_EXEMPTION' | 'COMBINATION' | 'ADMIN_ONLY';

export interface AddableStudent extends RosterStudent {
  reason: AddableReason;
  canAdd: boolean;
  blockedBy: AddableBlock | null;
  /** A mark already on file (for example a recorded Not sat), shown so nothing is lost. */
  existing: { score: number | null; isAbsent: boolean; notSat: boolean } | null;
}

@Injectable()
export class ExamMarksService {
  private readonly logger = new Logger(ExamMarksService.name);

  private static readonly PRIVILEGED: string[] = [
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.MANAGER,
    ROLES.HEAD_OF_SCHOOL,
    ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly studentClient: StudentClientService,
    private readonly assessments: AssessmentsService,
  ) {}

  private unwrap<T>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const p = payload as Record<string, unknown> | null;
    if (!p) return [];
    const inner = (p.data ?? p) as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as T[];
    for (const c of [inner?.items, inner?.students]) {
      if (Array.isArray(c)) return c as T[];
    }
    return [];
  }

  private studentServiceHeaders(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private studentName(s: any): string {
    return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').trim();
  }

  private async getAssessmentForTeacher(assessmentId: string, user: RequestUser) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        classSubject: { include: { subject: true } },
        examWindow: { select: { id: true, name: true, status: true, maxScore: true, termId: true } },
      },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    if (!assessment.examWindowId) {
      throw new BadRequestException('This assessment does not belong to an exam window.');
    }
    assertSchoolInScope(user, (assessment as { schoolId?: string | null }).schoolId ?? null);

    const isPrivileged = ExamMarksService.PRIVILEGED.includes(user.role);
    if (!isPrivileged && assessment.classSubject.teacherId !== user.id) {
      throw new ForbiddenException('You can only work on the marks for your own subjects.');
    }
    return assessment;
  }

  private async loadRoster(classId: string, user: RequestUser, assessment?: any): Promise<RosterStudent[]> {
    return (await this.loadRosterParts(classId, user, assessment)).roster;
  }

  /**
   * The grid roster (students who must have a mark) plus the rest of the class,
   * so the editor can offer to bring the others in.
   */
  private async loadRosterParts(classId: string, user: RequestUser, assessment?: any) {
    const all = await this.loadClassRoster(classId, user);
    if (!assessment) return { all, roster: all, expected: new Set<string>(), exempt: new Set<string>() };
    // Optional / combination subjects: only students who take the subject, and who are not exempt.
    const { expected, exempt, required } = await resolveExpectedStudents(this.prisma, assessment, all.map((r) => r.studentId));
    return { all, roster: all.filter((r) => required.has(r.studentId)), expected, exempt };
  }

  /** Class students who are not in the grid (exempt, or not registered for the subject), with the reason. */
  private async buildAddable(
    assessment: any,
    parts: { all: RosterStudent[]; roster: RosterStudent[]; expected: Set<string>; exempt: Set<string> },
    user: RequestUser,
  ): Promise<AddableStudent[]> {
    const inGrid = new Set(parts.roster.map((r) => r.studentId));
    const rest = parts.all.filter((r) => !inGrid.has(r.studentId));
    if (!rest.length) return [];

    const ids = rest.map((r) => r.studentId);
    const [marks, exemptions] = await Promise.all([
      this.prisma.mark.findMany({
        where: { assessmentId: assessment.id, studentId: { in: ids } },
        select: { studentId: true, score: true, isAbsent: true, notSat: true },
      }),
      this.prisma.resultCalculationExemption.findMany({
        where: this.exemptionWhere(assessment),
        select: { studentId: true },
      }),
    ]);
    const markOf = new Map(marks.map((m) => [m.studentId, m]));
    const classWide = exemptions.some((e) => e.studentId === null);
    const privileged = ExamMarksService.PRIVILEGED.includes(user.role);

    return rest.map((r) => {
      const m = markOf.get(r.studentId);
      const existing = m ? { score: m.score ?? null, isAbsent: m.isAbsent, notSat: m.notSat } : null;
      if (parts.exempt.has(r.studentId)) {
        const blocked = classWide && !exemptions.some((e) => e.studentId === r.studentId);
        return { ...r, reason: 'EXEMPT' as const, canAdd: !blocked, blockedBy: blocked ? ('CLASS_EXEMPTION' as const) : null, existing };
      }
      const combination = !!assessment.classSubject?.combinationId;
      const blockedBy: AddableBlock | null = combination ? 'COMBINATION' : !privileged ? 'ADMIN_ONLY' : null;
      return { ...r, reason: 'NOT_TAKING' as const, canAdd: blockedBy === null, blockedBy, existing };
    });
  }

  private exemptionWhere(assessment: any): Prisma.ResultCalculationExemptionWhereInput {
    return {
      status: ExemptionStatus.APPROVED,
      classId: assessment.classId,
      subjectId: assessment.subjectId,
      termId: assessment.termId,
      OR: assessment.examWindowId ? [{ examWindowId: null }, { examWindowId: assessment.examWindowId }] : [{ examWindowId: null }],
    };
  }

  private async loadClassRoster(classId: string, user: RequestUser): Promise<RosterStudent[]> {
    const payload = await this.studentClient.get<unknown>(
      '/students',
      { classId, limit: 2000, page: 1 },
      this.studentServiceHeaders(user),
    );
    return this.unwrap<any>(payload)
      .map((s) => ({
        studentId: s.id,
        registrationNumber: s.registrationNumber ?? null,
        name: this.studentName(s),
      }))
      .sort((a, b) => (a.registrationNumber ?? '').localeCompare(b.registrationNumber ?? ''));
  }

  /** Structured template: metadata + pre-filled roster rows, for the dashboard to render/export. */
  async getTemplateData(assessmentId: string, user: RequestUser) {
    const assessment = await this.getAssessmentForTeacher(assessmentId, user);
    const parts = await this.loadRosterParts(assessment.classId, user, assessment);
    const roster = parts.roster;
    const addable = await this.buildAddable(assessment, parts, user);

    const existing = await this.prisma.mark.findMany({
      where: { assessmentId },
      select: { studentId: true, score: true, isAbsent: true, notSat: true, note: true },
    });
    const markMap = new Map(existing.map((m) => [m.studentId, m]));

    return {
      assessment: {
        id: assessment.id,
        subjectName: assessment.classSubject.subject.name,
        subjectCode: assessment.classSubject.subject.code,
        classId: assessment.classId,
        maxScore: assessment.maxScore,
        status: assessment.status,
        examWindow: assessment.examWindow,
      },
      columns: ['registration_number', 'student_name', 'score', 'is_absent', 'not_sat', 'note'],
      rows: roster.map((r) => {
        const m = markMap.get(r.studentId);
        return {
          registrationNumber: r.registrationNumber,
          studentName: r.name,
          score: m && !m.isAbsent && !m.notSat ? m.score : '',
          isAbsent: (m?.isAbsent ?? false) && !(m?.notSat ?? false),
          notSat: m?.notSat ?? false,
          note: m?.note ?? '',
        };
      }),
      rosterSize: roster.length,
      /** Class students the grid does not list (exempt / not registered); the editor can add them. */
      addable,
    };
  }

  private csvEscape(v: unknown): string {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  /** Ready-to-fill CSV (opens directly in Excel), pre-populated with the class roster. */
  async buildTemplateCsv(assessmentId: string, user: RequestUser): Promise<{ filename: string; csv: string }> {
    const data = await this.getTemplateData(assessmentId, user);
    const win = data.assessment.examWindow;
    const lines: string[] = [];
    lines.push(`# Exam Window: ${win?.name ?? ''}`);
    lines.push(`# Subject: ${data.assessment.subjectName}  |  Max Score: ${data.assessment.maxScore}`);
    lines.push('# Fill the "score" column (0 to max). Absent on the day: put yes in "is_absent". Required to sit but did not: put yes in "not_sat". Do not edit registration_number.');
    lines.push(data.columns.join(','));
    for (const r of data.rows) {
      lines.push([
        this.csvEscape(r.registrationNumber),
        this.csvEscape(r.studentName),
        this.csvEscape(r.score),
        this.csvEscape(r.isAbsent ? 'yes' : ''),
        this.csvEscape(r.notSat ? 'yes' : ''),
        this.csvEscape(r.note),
      ].join(','));
    }
    const safeSubject = data.assessment.subjectName.replace(/[^a-z0-9]+/gi, '-');
    const filename = `marks-template-${safeSubject}-${assessmentId.slice(0, 8)}.csv`;
    return { filename, csv: lines.join('\r\n') + '\r\n' };
  }

  private blockMessage(blockedBy: AddableBlock | null): string {
    switch (blockedBy) {
      case 'CLASS_EXEMPTION':
        return 'the whole class is exempt from this subject. Remove that exemption on the Exemptions page first.';
      case 'COMBINATION':
        return "this subject belongs to a combination the student is not in. Change the student's combination first.";
      case 'ADMIN_ONLY':
        return 'the student is not registered for this subject. Ask an administrator to add them.';
      default:
        return 'not allowed.';
    }
  }

  /**
   * Make the student count for this subject again, in the same transaction as the mark:
   * lift their exemption, or register them for the optional subject. Both are audited.
   */
  private async admitStudent(tx: Prisma.TransactionClient, assessment: any, a: AddableStudent, user: RequestUser) {
    const schoolId: string | null = assessment.schoolId ?? null;
    if (a.reason === 'EXEMPT') {
      const revoked = await tx.resultCalculationExemption.updateMany({
        where: { ...this.exemptionWhere(assessment), studentId: a.studentId },
        data: {
          status: ExemptionStatus.REVOKED,
          revokedById: user.id,
          revokedAt: new Date(),
          revokeReason: 'A mark was entered for this student, so they sat the exam.',
        },
      });
      await tx.academicAuditLog.create({
        data: {
          schoolId,
          action: 'MARKS_ADD_EXEMPT_STUDENT',
          performedById: user.id,
          payload: { assessmentId: assessment.id, studentId: a.studentId, exemptionsRevoked: revoked.count } as unknown as Prisma.InputJsonValue,
        },
      });
      return;
    }
    const existing = await tx.studentSubjectEnrollment.findFirst({
      where: { studentId: a.studentId, subjectId: assessment.subjectId, academicYearId: assessment.academicYearId, termId: null },
    });
    if (existing) {
      if (!existing.isActive) await tx.studentSubjectEnrollment.update({ where: { id: existing.id }, data: { isActive: true } });
    } else {
      await tx.studentSubjectEnrollment.create({
        data: {
          studentId: a.studentId,
          classId: assessment.classId,
          subjectId: assessment.subjectId,
          academicYearId: assessment.academicYearId,
          termId: null,
        },
      });
    }
    await tx.academicAuditLog.create({
      data: {
        schoolId,
        action: 'MARKS_ADD_UNREGISTERED_STUDENT',
        performedById: user.id,
        payload: { assessmentId: assessment.id, studentId: a.studentId, subjectId: assessment.subjectId } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private parseBool(v: unknown): boolean {
    return ['true', '1', 'yes', 'y', 'absent', 'not sat', 'notsat', 'ns'].includes(String(v ?? '').toLowerCase().trim());
  }

  /**
   * Tolerant marks upload: validates every row, applies the valid ones, and
   * returns a per-row error report for the rest. A single bad row never blocks
   * the whole upload — the teacher fixes only what failed and re-uploads.
   */
  async uploadMarks(assessmentId: string, dto: UploadMarksDto, user: RequestUser) {
    const assessment = await this.getAssessmentForTeacher(assessmentId, user);

    const windowOpen = assessment.examWindow?.status === 'OPEN' || assessment.examWindow?.status === 'REOPENED';
    const editable: AssessmentStatus[] = [
      AssessmentStatus.OPEN,
      AssessmentStatus.DRAFT,
      AssessmentStatus.REJECTED,
      // Submitted but the window has not closed yet: the teacher may still fix a slip without asking anyone.
      ...(windowOpen ? [AssessmentStatus.SUBMITTED] : []),
    ];
    if (!editable.includes(assessment.status)) {
      throw new BadRequestException(
        `This subject is not open for marks entry (status: ${assessment.status}). ` +
          `Marks are locked once the window closes or results are published: ask your Head of Department or an administrator for permission to edit.`,
      );
    }

    const parts = await this.loadRosterParts(assessment.classId, user, assessment);
    const roster = [...parts.roster];
    // Students the grid does not list but the teacher chose to bring in ("Add students").
    const addable = (dto.rows ?? []).some((r) => r.add === true) ? await this.buildAddable(assessment, parts, user) : [];
    const addableById = new Map(addable.map((a) => [a.studentId, a]));
    const adds = new Map<string, AddableStudent>();
    const byReg = new Map(roster.filter((r) => r.registrationNumber).map((r) => [r.registrationNumber!.toUpperCase().trim(), r]));
    const byId = new Map(roster.map((r) => [r.studentId, r]));

    const errors: Array<{ row: number | null; registrationNumber?: string; message: string }> = [];
    const valid = new Map<string, { studentId: string; score: number; isAbsent: boolean; notSat: boolean; note?: string }>();

    (dto.rows ?? []).forEach((raw, index) => {
      const rowNum = raw.row ?? index + 2; // +2 ≈ header + 1-based
      const regRaw = (raw.registrationNumber ?? '').toString().trim();

      // Resolve the student.
      let student: RosterStudent | undefined;
      if (raw.studentId && byId.has(raw.studentId)) {
        student = byId.get(raw.studentId);
      } else if (regRaw) {
        student = byReg.get(regRaw.toUpperCase());
      }
      if (!student && raw.add === true) {
        const candidate = raw.studentId
          ? addableById.get(raw.studentId)
          : addable.find((a) => (a.registrationNumber ?? '').toUpperCase().trim() === regRaw.toUpperCase());
        if (!candidate) {
          errors.push({ row: rowNum, registrationNumber: regRaw, message: `"${regRaw || raw.studentId}" is not a student of this class.` });
          return;
        }
        const shown = candidate.registrationNumber ?? undefined;
        if (!candidate.canAdd) {
          errors.push({ row: rowNum, registrationNumber: shown, message: `${candidate.name} cannot be added here: ${this.blockMessage(candidate.blockedBy)}` });
          return;
        }
        if (!windowOpen) {
          errors.push({ row: rowNum, registrationNumber: shown, message: 'Students can only be added while the exam window is open.' });
          return;
        }
        if (raw.isAbsent === true || raw.notSat === true || this.parseBool(raw.isAbsent as unknown) || this.parseBool(raw.notSat as unknown)) {
          errors.push({ row: rowNum, registrationNumber: shown, message: `${candidate.name}: enter a score to add this student (Absent and Not sat are already left out).` });
          return;
        }
        student = candidate;
        adds.set(candidate.studentId, candidate);
      }
      if (!student) {
        errors.push({ row: rowNum, registrationNumber: regRaw, message: `No student "${regRaw || raw.studentId}" in this class.` });
        return;
      }

      const notSat = raw.notSat === true || this.parseBool(raw.notSat as unknown);
      const isAbsent = notSat || raw.isAbsent === true || this.parseBool(raw.isAbsent as unknown);
      let score: number;
      if (isAbsent) {
        score = 0;
      } else {
        if (raw.score === undefined || raw.score === null || (raw.score as unknown) === '') {
          errors.push({ row: rowNum, registrationNumber: student.registrationNumber ?? undefined, message: 'Score is empty. Enter a score, or mark the student Absent / Not sat.' });
          return;
        }
        const parsed = Number(raw.score);
        if (Number.isNaN(parsed)) {
          errors.push({ row: rowNum, registrationNumber: student.registrationNumber ?? undefined, message: `Score "${raw.score}" is not a number.` });
          return;
        }
        if (parsed < 0 || parsed > assessment.maxScore) {
          errors.push({ row: rowNum, registrationNumber: student.registrationNumber ?? undefined, message: `Score ${parsed} is out of range (0–${assessment.maxScore}).` });
          return;
        }
        score = parsed;
      }

      if (valid.has(student.studentId)) {
        errors.push({ row: rowNum, registrationNumber: student.registrationNumber ?? undefined, message: 'Duplicate row for this student — only the first was kept.' });
        return;
      }
      valid.set(student.studentId, { studentId: student.studentId, score, isAbsent, notSat, note: raw.note?.toString().trim() || undefined });
    });

    // An added student whose row failed validation must not be registered or un-exempted.
    for (const id of [...adds.keys()]) if (!valid.has(id)) adds.delete(id);

    // Apply the valid rows.
    const entries = [...valid.values()];
    if (entries.length) {
      await this.prisma.$transaction(async (tx) => {
        for (const a of adds.values()) await this.admitStudent(tx, assessment, a, user);
        for (const e of entries) {
          await tx.mark.upsert({
            where: { assessmentId_studentId: { assessmentId, studentId: e.studentId } },
            create: {
              assessmentId,
              classSubjectId: assessment.classSubjectId,
              studentId: e.studentId,
              score: e.score,
              isAbsent: e.isAbsent,
              notSat: e.notSat,
              note: e.note,
              enteredById: user.id,
            },
            update: {
              score: e.score,
              isAbsent: e.isAbsent,
              notSat: e.notSat,
              note: e.note,
              lastEditedById: user.id,
              lastEditedAt: new Date(),
            },
          });
        }
        await tx.assessment.update({ where: { id: assessmentId }, data: { status: AssessmentStatus.OPEN, updatedAt: new Date() } });
      });
      await this.redis.del(`marks-sheet:${assessmentId}`, `class-results:${assessment.classId}:${assessment.termId}`);
      if (adds.size && assessment.examWindowId) await this.redis.delByPattern(`exam-window:*:${assessment.examWindowId}`);
    }
    for (const a of adds.values()) roster.push(a);

    // Coverage + optional auto-submit.
    const markedCount = await this.prisma.mark.count({ where: { assessmentId, studentId: { in: roster.map((r) => r.studentId) } } });
    const missing = roster.length - markedCount;
    let autoSubmitted = false;
    let submitMessage: string | undefined;
    if (dto.autoSubmit) {
      if (missing <= 0 && roster.length > 0) {
        try {
          await this.assessments.submitAssessment(assessmentId, {} as any, user);
          autoSubmitted = true;
        } catch (err) {
          submitMessage = `Marks saved but auto-submit failed: ${(err as Error)?.message ?? err}`;
        }
      } else {
        submitMessage = `Not submitted — ${missing} student(s) still have no mark.`;
      }
    }

    return {
      total: dto.rows?.length ?? 0,
      applied: entries.length,
      skipped: (dto.rows?.length ?? 0) - entries.length,
      errors,
      rosterSize: roster.length,
      marksEntered: markedCount,
      added: adds.size,
      missing: Math.max(missing, 0),
      autoSubmitted,
      message:
        submitMessage ??
        (errors.length
          ? `${entries.length} saved, ${errors.length} row(s) need attention.`
          : adds.size
            ? `${entries.length} marks saved, including ${adds.size} added student${adds.size === 1 ? '' : 's'}. Recalculate the results when you are done.`
            : `${entries.length} marks saved.`),
      assessmentStatus: autoSubmitted ? AssessmentStatus.SUBMITTED : AssessmentStatus.OPEN,
    };
  }
}
