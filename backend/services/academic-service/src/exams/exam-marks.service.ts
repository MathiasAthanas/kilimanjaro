import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { AssessmentsService } from '../assessments/assessments.service';
import { UploadMarksDto } from './dto/upload-marks.dto';

interface RosterStudent {
  studentId: string;
  registrationNumber: string | null;
  name: string;
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

  private async loadRoster(classId: string, user: RequestUser): Promise<RosterStudent[]> {
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
    const roster = await this.loadRoster(assessment.classId, user);

    const existing = await this.prisma.mark.findMany({
      where: { assessmentId },
      select: { studentId: true, score: true, isAbsent: true, note: true },
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
      columns: ['registration_number', 'student_name', 'score', 'is_absent', 'note'],
      rows: roster.map((r) => {
        const m = markMap.get(r.studentId);
        return {
          registrationNumber: r.registrationNumber,
          studentName: r.name,
          score: m && !m.isAbsent ? m.score : '',
          isAbsent: m?.isAbsent ?? false,
          note: m?.note ?? '',
        };
      }),
      rosterSize: roster.length,
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
    lines.push('# Fill the "score" column (0 to max). For an absent student put yes in "is_absent". Do not edit registration_number.');
    lines.push(data.columns.join(','));
    for (const r of data.rows) {
      lines.push([
        this.csvEscape(r.registrationNumber),
        this.csvEscape(r.studentName),
        this.csvEscape(r.score),
        this.csvEscape(r.isAbsent ? 'yes' : ''),
        this.csvEscape(r.note),
      ].join(','));
    }
    const safeSubject = data.assessment.subjectName.replace(/[^a-z0-9]+/gi, '-');
    const filename = `marks-template-${safeSubject}-${assessmentId.slice(0, 8)}.csv`;
    return { filename, csv: lines.join('\r\n') + '\r\n' };
  }

  private parseBool(v: unknown): boolean {
    return ['true', '1', 'yes', 'y', 'absent'].includes(String(v ?? '').toLowerCase().trim());
  }

  /**
   * Tolerant marks upload: validates every row, applies the valid ones, and
   * returns a per-row error report for the rest. A single bad row never blocks
   * the whole upload — the teacher fixes only what failed and re-uploads.
   */
  async uploadMarks(assessmentId: string, dto: UploadMarksDto, user: RequestUser) {
    const assessment = await this.getAssessmentForTeacher(assessmentId, user);

    const editable: AssessmentStatus[] = [
      AssessmentStatus.OPEN,
      AssessmentStatus.DRAFT,
      AssessmentStatus.REJECTED,
    ];
    if (!editable.includes(assessment.status)) {
      throw new BadRequestException(
        `This subject is not open for marks entry (status: ${assessment.status}). ` +
          `If it is locked, request an edit from the exam administrator.`,
      );
    }

    const roster = await this.loadRoster(assessment.classId, user);
    const byReg = new Map(roster.filter((r) => r.registrationNumber).map((r) => [r.registrationNumber!.toUpperCase().trim(), r]));
    const byId = new Map(roster.map((r) => [r.studentId, r]));

    const errors: Array<{ row: number | null; registrationNumber?: string; message: string }> = [];
    const valid = new Map<string, { studentId: string; score: number; isAbsent: boolean; note?: string }>();

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
      if (!student) {
        errors.push({ row: rowNum, registrationNumber: regRaw, message: `No student "${regRaw || raw.studentId}" in this class.` });
        return;
      }

      const isAbsent = raw.isAbsent === true || this.parseBool(raw.isAbsent as unknown);
      let score: number;
      if (isAbsent) {
        score = 0;
      } else {
        if (raw.score === undefined || raw.score === null || (raw.score as unknown) === '') {
          errors.push({ row: rowNum, registrationNumber: student.registrationNumber ?? undefined, message: 'Score is empty. Enter a score or mark the student absent.' });
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
      valid.set(student.studentId, { studentId: student.studentId, score, isAbsent, note: raw.note?.toString().trim() || undefined });
    });

    // Apply the valid rows.
    const entries = [...valid.values()];
    if (entries.length) {
      await this.prisma.$transaction(async (tx) => {
        for (const e of entries) {
          await tx.mark.upsert({
            where: { assessmentId_studentId: { assessmentId, studentId: e.studentId } },
            create: {
              assessmentId,
              classSubjectId: assessment.classSubjectId,
              studentId: e.studentId,
              score: e.score,
              isAbsent: e.isAbsent,
              note: e.note,
              enteredById: user.id,
            },
            update: {
              score: e.score,
              isAbsent: e.isAbsent,
              note: e.note,
              lastEditedById: user.id,
              lastEditedAt: new Date(),
            },
          });
        }
        await tx.assessment.update({ where: { id: assessmentId }, data: { status: AssessmentStatus.OPEN, updatedAt: new Date() } });
      });
      await this.redis.del(`marks-sheet:${assessmentId}`, `class-results:${assessment.classId}:${assessment.termId}`);
    }

    // Coverage + optional auto-submit.
    const markedCount = await this.prisma.mark.count({ where: { assessmentId } });
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
      missing: Math.max(missing, 0),
      autoSubmitted,
      message:
        submitMessage ??
        (errors.length
          ? `${entries.length} saved, ${errors.length} row(s) need attention.`
          : `${entries.length} marks saved.`),
      assessmentStatus: autoSubmitted ? AssessmentStatus.SUBMITTED : AssessmentStatus.OPEN,
    };
  }
}
