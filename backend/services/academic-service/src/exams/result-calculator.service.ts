import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExemptionStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { GradingResolverService } from './grading-resolver.service';
import {
  buildOutcome,
  competitionRanks,
  isSubjectExpected,
  resolveBand,
  round,
  scaleDirection,
  ResolvedGrade,
  StudentSummary,
  SubjectOutcome,
  summarizeStudent,
} from './engine/result-engine';

export interface CalcExemption {
  id: string;
  classId: string;
  subjectId: string;
  studentId: string | null;
  examWindowId: string | null;
  reason: string;
}

export interface CalcStudentRow {
  studentId: string;
  classId: string;
  className: string | null;
  stream: string | null;
  classLevel: number | null;
  educationStage: string;
  registrationNumber: string | null;
  studentName: string | null;
  gender: string | null;
  outcomes: SubjectOutcome[];
  subjectScores: Record<string, SubjectOutcome>;
  summary: StudentSummary;
  overall: ResolvedGrade;
  classMeanDev: number;
  standardMeanDev: number;
  prevWindowMean: number | null;
  prevWindowDelta: number | null;
  streamRank?: number;
  streamTotal?: number;
  standardRank?: number;
  standardTotal?: number;
  warnings: string[];
}

export interface MissingEntry {
  studentId: string;
  studentName: string;
  registrationNumber: string | null;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string;
}

export interface ScaleIssue {
  educationStage: string | null;
  classLevel: number | null;
  classNames: string[];
  message: string;
}

export interface CalcContext {
  window: any;
  classIds: string[];
  rows: CalcStudentRow[];
  missing: MissingEntry[];
  scaleIssues: ScaleIssue[];
  warnings: string[];
}

export const INCOMPLETE_HINT = 'Enter a score, mark the student ABSENT/NOT SAT, or approve an exemption.';

/**
 * Single place that turns raw marks + rosters + enrolments + exemptions into
 * per-student, per-subject statuses and averages for an exam window. Readiness,
 * closing, recomputation, the impact preview and the merit list all go through
 * here so they can never disagree.
 */
@Injectable()
export class ResultCalculatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentClient: StudentClientService,
    private readonly grading: GradingResolverService,
  ) {}

  private unwrap<T>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const p = payload as Record<string, unknown> | null;
    if (!p) return [];
    const inner = (p.data ?? p) as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as T[];
    for (const c of [inner?.items, inner?.classes, inner?.students]) {
      if (Array.isArray(c)) return c as T[];
    }
    return [];
  }

  private studentServiceHeaders(user?: RequestUser): Record<string, string> {
    if (!user) return {};
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

  /** Approved exemptions that apply to a window (its own + whole-term ones). */
  async loadExemptions(window: { id: string; academicYearId: string; termId: string; schoolId: string | null }): Promise<CalcExemption[]> {
    const rows = await this.prisma.resultCalculationExemption.findMany({
      where: {
        status: ExemptionStatus.APPROVED,
        academicYearId: window.academicYearId,
        termId: window.termId,
        OR: [{ examWindowId: null }, { examWindowId: window.id }],
      },
      select: { id: true, classId: true, subjectId: true, studentId: true, examWindowId: true, reason: true },
    });
    return rows;
  }

  /**
   * Load everything for a window and compute per-student rows. `extraExemptions`
   * lets the impact preview ask "what if" without writing anything.
   */
  async build(windowId: string, user?: RequestUser, extraExemptions: CalcExemption[] = []): Promise<CalcContext> {
    const window = await this.prisma.examWindow.findUnique({ where: { id: windowId } });
    if (!window) throw new NotFoundException('Exam window not found');
    if (user) assertSchoolInScope(user, window.schoolId ?? null);

    const allAssessments = await this.prisma.assessment.findMany({
      where: { examWindowId: windowId },
      include: { classSubject: { include: { subject: true } } },
    });
    // Inactive class-subjects / subjects are not expected and need no exemption.
    const assessments = allAssessments.filter((a) => a.classSubject.isActive && a.classSubject.subject.isActive);
    if (!assessments.length) {
      throw new BadRequestException('This window has no active subject assessments to calculate. Open the window first.');
    }

    const classIds = [...new Set(assessments.map((a) => a.classId))];

    const classesPayload = await this.studentClient.get<unknown>(
      '/students/classes',
      { academicYearId: window.academicYearId, limit: 1000 },
      this.studentServiceHeaders(user),
    );
    const classMeta = new Map<string, { name: string | null; level: number | null; stream: string | null; educationStage: string | null }>();
    for (const c of this.unwrap<any>(classesPayload)) {
      classMeta.set(c.id, { name: c.name, level: c.level ?? null, stream: c.stream ?? null, educationStage: c.educationStage ?? null });
    }

    const studentsByClass = new Map<string, any[]>();
    const allStudentIds: string[] = [];
    for (const classId of classIds) {
      const payload = await this.studentClient.get<unknown>('/students', { classId, limit: 2000, page: 1 }, this.studentServiceHeaders(user));
      const list = this.unwrap<any>(payload);
      studentsByClass.set(classId, list);
      for (const s of list) allStudentIds.push(s.id);
    }

    const marks = await this.prisma.mark.findMany({
      where: { assessmentId: { in: assessments.map((a) => a.id) } },
      select: { assessmentId: true, studentId: true, score: true, isAbsent: true, notSat: true },
    });
    const marksByAssessment = new Map<string, Map<string, { score: number; isAbsent: boolean; notSat: boolean }>>();
    for (const m of marks) {
      let inner = marksByAssessment.get(m.assessmentId);
      if (!inner) marksByAssessment.set(m.assessmentId, (inner = new Map()));
      inner.set(m.studentId, { score: m.score, isAbsent: m.isAbsent, notSat: m.notSat });
    }

    // Enrolments → optional subjects and A-Level combinations.
    const enrolments = allStudentIds.length
      ? await this.prisma.studentSubjectEnrollment.findMany({
          where: {
            studentId: { in: allStudentIds },
            academicYearId: window.academicYearId,
            isActive: true,
            OR: [{ termId: null }, { termId: window.termId }],
          },
          select: { studentId: true, subjectId: true, combinationId: true },
        })
      : [];
    const enrolByStudent = new Map<string, { subjectIds: Set<string>; combinationId: string | null }>();
    for (const e of enrolments) {
      const cur = enrolByStudent.get(e.studentId) ?? { subjectIds: new Set<string>(), combinationId: null };
      cur.subjectIds.add(e.subjectId);
      if (e.combinationId) cur.combinationId = e.combinationId;
      enrolByStudent.set(e.studentId, cur);
    }
    // A class whose combination-bound subjects all share ONE combination is a single-combination cohort:
    // students without their own enrolment record inherit it.
    const classComboByClass = new Map<string, string | null>();
    for (const classId of classIds) {
      const distinct = new Set(
        assessments.filter((a) => a.classId === classId && a.classSubject.combinationId).map((a) => a.classSubject.combinationId as string),
      );
      classComboByClass.set(classId, distinct.size === 1 ? [...distinct][0] : null);
    }
    const comboIds = [
      ...new Set([
        ...([...enrolByStudent.values()].map((e) => e.combinationId).filter(Boolean) as string[]),
        ...([...classComboByClass.values()].filter(Boolean) as string[]),
      ]),
    ];
    const comboSubjects = new Map<string, Set<string>>();
    if (comboIds.length) {
      const rows = await this.prisma.subjectCombinationSubject.findMany({
        where: { combinationId: { in: comboIds } },
        select: { combinationId: true, subjectId: true },
      });
      for (const r of rows) {
        if (!comboSubjects.has(r.combinationId)) comboSubjects.set(r.combinationId, new Set());
        comboSubjects.get(r.combinationId)!.add(r.subjectId);
      }
    }

    const exemptions = [...(await this.loadExemptions(window)), ...extraExemptions];
    const exemptionIndex = new Map<string, CalcExemption[]>();
    for (const ex of exemptions) {
      const key = `${ex.classId}:${ex.subjectId}`;
      const arr = exemptionIndex.get(key) ?? [];
      arr.push(ex);
      exemptionIndex.set(key, arr);
    }
    const findExemption = (classId: string, subjectId: string, studentId: string) =>
      (exemptionIndex.get(`${classId}:${subjectId}`) ?? []).find((e) => e.studentId === null || e.studentId === studentId) ?? null;

    // Scales (cached) — failures are collected, not thrown, so readiness can report them.
    const scaleCache = new Map<string, any | null>();
    const scaleIssueKeys = new Map<string, ScaleIssue>();
    const scaleFor = async (stage: string | null, level: number | null, subjectId: string | null, className?: string | null) => {
      const key = `${stage}:${level}:${subjectId}`;
      if (scaleCache.has(key)) return scaleCache.get(key);
      try {
        const scale = await this.grading.getActiveScale(
          window.academicYearId,
          { educationStage: stage, classLevel: level, subjectId },
          window.schoolId ?? null,
        );
        scaleCache.set(key, scale);
        return scale;
      } catch (err) {
        scaleCache.set(key, null);
        const issueKey = `${stage}:${level}`;
        const issue = scaleIssueKeys.get(issueKey) ?? {
          educationStage: stage,
          classLevel: level,
          classNames: [],
          message: `No active grading scale for ${stage ?? 'this stage'}${level !== null ? ` level ${level}` : ''} in this academic year. Create and activate one in Academic Setup → Grading before calculating results.`,
        };
        if (className && !issue.classNames.includes(className)) issue.classNames.push(className);
        scaleIssueKeys.set(issueKey, issue);
        return null;
      }
    };

    const rows: CalcStudentRow[] = [];
    const missing: MissingEntry[] = [];
    const warnings: string[] = [];
    const assessmentsByClass = new Map<string, typeof assessments>();
    for (const a of assessments) {
      const arr = assessmentsByClass.get(a.classId) ?? [];
      arr.push(a);
      assessmentsByClass.set(a.classId, arr as any);
    }

    for (const classId of classIds) {
      const meta = classMeta.get(classId) ?? { name: null, level: null, stream: null, educationStage: null };
      const stage = meta.educationStage ?? window.educationStage ?? 'PRIMARY';
      const classAssessments = assessmentsByClass.get(classId) ?? ([] as any[]);
      const overallScale = await scaleFor(stage, meta.level, null, meta.name);

      // Principal subjects per combination (A-Level divisions).
      const principalsByCombo = new Map<string, Set<string>>();
      if (stage === 'A_LEVEL' && comboIds.length) {
        const principalRows = await this.prisma.subjectCombinationSubject.findMany({
          where: { combinationId: { in: comboIds }, subjectRole: 'PRINCIPAL' },
          select: { combinationId: true, subjectId: true },
        });
        for (const r of principalRows) {
          if (!principalsByCombo.has(r.combinationId)) principalsByCombo.set(r.combinationId, new Set());
          principalsByCombo.get(r.combinationId)!.add(r.subjectId);
        }
      }

      for (const s of studentsByClass.get(classId) ?? []) {
        const own = enrolByStudent.get(s.id) ?? { subjectIds: new Set<string>(), combinationId: null };
        const enrol = { subjectIds: own.subjectIds, combinationId: own.combinationId ?? classComboByClass.get(classId) ?? null };
        const rowWarnings: string[] = [];
        if (stage === 'A_LEVEL' && !enrol.combinationId) {
          rowWarnings.push('No subject combination recorded for this A-Level student.');
        }

        const outcomes: SubjectOutcome[] = [];
        for (const a of classAssessments) {
          const expected = isSubjectExpected({
            stage,
            classSubject: { subjectId: a.subjectId, combinationId: a.classSubject.combinationId, isCompulsory: a.classSubject.subject.isCompulsory },
            enrolledSubjectIds: enrol.subjectIds,
            studentCombinationId: enrol.combinationId,
            combinationSubjectIds: enrol.combinationId ? comboSubjects.get(enrol.combinationId) : undefined,
          });
          if (!expected) continue;

          const scale = (await scaleFor(a.educationStage, a.classLevel ?? meta.level, a.subjectId, meta.name)) ?? { grades: [] };
          const exemption = findExemption(classId, a.subjectId, s.id);
          const outcome = buildOutcome({
            subjectId: a.subjectId,
            subjectName: a.classSubject.subject.name,
            code: a.classSubject.subject.code,
            maxScore: a.maxScore || window.maxScore || 100,
            mark: marksByAssessment.get(a.id)?.get(s.id) ?? null,
            exemption: exemption ? { id: exemption.id, reason: exemption.reason } : null,
            scale,
          });
          outcomes.push(outcome);
          if (outcome.status === 'MISSING') {
            missing.push({
              studentId: s.id,
              studentName: this.studentName(s),
              registrationNumber: s.registrationNumber ?? null,
              classId,
              className: meta.name,
              subjectId: a.subjectId,
              subjectName: a.classSubject.subject.name,
            });
          }
        }

        const summary = summarizeStudent(
          stage,
          outcomes,
          enrol.combinationId ? principalsByCombo.get(enrol.combinationId) : undefined,
          scaleDirection(overallScale) ?? 'HIGHER_BETTER',
        );
        const overall: ResolvedGrade = summary.subjectsAssessed
          ? resolveBand(overallScale ?? { grades: [] }, summary.mean)
          : { grade: '-', points: 0, remark: 'No assessed subjects', isPassing: false };

        rows.push({
          studentId: s.id,
          classId,
          className: meta.name,
          stream: meta.stream,
          classLevel: meta.level,
          educationStage: stage,
          registrationNumber: s.registrationNumber ?? null,
          studentName: this.studentName(s),
          gender: s.gender ?? null,
          outcomes,
          subjectScores: Object.fromEntries(outcomes.map((o) => [o.subjectId, o])),
          summary,
          overall,
          classMeanDev: 0,
          standardMeanDev: 0,
          prevWindowMean: null,
          prevWindowDelta: null,
          warnings: rowWarnings,
        });
        for (const w of rowWarnings) {
          if (!warnings.includes(w)) warnings.push(w);
        }
      }
    }

    // Ranks by NORMALIZED AVERAGE (not raw totals) so subjects with different maxima are fair.
    for (const classId of classIds) {
      const group = rows.filter((r) => r.classId === classId);
      if (!group.length) continue;
      const streamMean = group.reduce((s, r) => s + r.summary.mean, 0) / group.length;
      const ranks = competitionRanks(group, (r) => r.studentId, (r) => r.summary.mean);
      for (const r of group) {
        r.streamRank = ranks[r.studentId];
        r.streamTotal = group.length;
        r.classMeanDev = round(r.summary.mean - streamMean);
      }
    }
    // A standard is (educationStage, level): Primary Class 6 and A-Level Form 6 never rank together.
    const standardKey = (r: CalcStudentRow) => `${r.educationStage}::${r.classLevel}`;
    const standardKeys = [...new Set(rows.filter((r) => r.classLevel !== null).map(standardKey))];
    for (const key of standardKeys) {
      const group = rows.filter((r) => r.classLevel !== null && standardKey(r) === key);
      const standardMean = group.reduce((s, r) => s + r.summary.mean, 0) / group.length;
      const ranks = competitionRanks(group, (r) => r.studentId, (r) => r.summary.mean);
      for (const r of group) {
        r.standardRank = ranks[r.studentId];
        r.standardTotal = group.length;
        r.standardMeanDev = round(r.summary.mean - standardMean);
      }
    }
    for (const r of rows) {
      if (r.classLevel === null) {
        r.standardRank = r.streamRank;
        r.standardTotal = r.streamTotal;
      }
    }

    return { window, classIds, rows, missing, scaleIssues: [...scaleIssueKeys.values()], warnings };
  }

  /** The blocking error thrown when a window cannot be calculated/closed yet. */
  incompleteError(missing: MissingEntry[]): BadRequestException {
    const first = missing[0];
    const more = missing.length - 1;
    const head = `${first.studentName} is missing ${first.subjectName.match(/^[aeiou]/i) ? 'an' : 'a'} ${first.subjectName} result.`;
    const message =
      more > 0
        ? `${head} ${more} more result${more === 1 ? ' is' : 's are'} also missing.\n${INCOMPLETE_HINT}`
        : `${head}\n${INCOMPLETE_HINT}`;
    return new BadRequestException({
      statusCode: 400,
      message,
      code: 'RESULTS_INCOMPLETE',
      details: { missingCount: missing.length, missing: missing.slice(0, 500) },
    });
  }

  scaleError(issues: ScaleIssue[]): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      message: issues.map((i) => i.message).join(' '),
      code: 'GRADING_SCALE_MISSING',
      details: { issues },
    });
  }

  /** Throw if the window cannot be calculated: missing grading scale or unresolved marks. */
  assertCalculable(ctx: CalcContext): void {
    if (ctx.scaleIssues.length) throw this.scaleError(ctx.scaleIssues);
    if (ctx.missing.length) throw this.incompleteError(ctx.missing);
  }
}
