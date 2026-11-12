import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExamWindowStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, requireWriteSchoolId, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { GradingResolverService } from './grading-resolver.service';
import { ComposeReportCardsDto } from './dto/compose-report-cards.dto';
import { blendWindows, resolveBand, SubjectOutcome, SubjectStatus, validateWeights, WindowContribution } from './engine/result-engine';
import { ReportCardPolicyService } from '../report-cards/report-card-policy.service';

interface ClassSubjectMeta {
  classSubjectId: string;
  subjectName: string;
  teacherId: string;
  combinationId: string | null;
  educationStage: string;
  classLevel: number | null;
}

interface BlendedRow {
  studentId: string;
  classId: string;
  classLevel: number | null;
  educationStage: string;
  academicYearId: string;
  subjectId: string;
  subjectName: string;
  classSubjectId: string;
  teacherId: string;
  combinationId: string | null;
  status: SubjectStatus;
  blended: number;
  contributions: unknown[];
  grade: string;
  points: number;
  remark: string;
  isPassing: boolean;
  countsTowardAggregate: boolean;
  rank?: number;
}

/** Window results written before statuses existed carry no `status`; derive one without changing their numbers. */
function readOutcome(raw: any): SubjectOutcome {
  const status: SubjectStatus =
    raw.status ?? (raw.isAbsent ? 'ABSENT' : 'SCORED');
  return {
    subjectId: raw.subjectId,
    subjectName: raw.subjectName,
    code: raw.code,
    status,
    score: raw.score ?? 0,
    maxScore: raw.maxScore ?? 100,
    percentage: status === 'EXEMPT' || status === 'MISSING' ? null : raw.percentage ?? 0,
    grade: raw.grade ?? '',
    points: raw.points ?? 0,
    remark: raw.remark ?? '',
    isPassing: raw.isPassing ?? false,
    isAbsent: !!raw.isAbsent,
    missing: status === 'MISSING',
    exempt: status === 'EXEMPT',
    exemptionId: raw.exemptionId ?? null,
    exemptReason: raw.exemptReason ?? null,
    countsTowardAggregate: raw.countsTowardAggregate !== false,
  };
}

@Injectable()
export class ReportCompositionService {
  private readonly logger = new Logger(ReportCompositionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly grading: GradingResolverService,
    private readonly reportCards: ReportCardsService,
    private readonly reportCardPolicy: ReportCardPolicyService,
  ) {}

  /** Validate the selected windows and resolve their effective weights (must be positive and total exactly 100%). */
  private async resolveWindows(dto: ComposeReportCardsDto, user: RequestUser) {
    const ids = dto.windows.map((w) => w.examWindowId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A window can only be selected once.');
    }
    const windows = await this.prisma.examWindow.findMany({
      where: { id: { in: ids } },
      include: { examType: true, _count: { select: { results: true } } },
    });
    if (windows.length !== ids.length) {
      throw new BadRequestException('One or more selected exam windows do not exist.');
    }

    const usable: ExamWindowStatus[] = [ExamWindowStatus.CLOSED, ExamWindowStatus.PUBLISHED, ExamWindowStatus.REOPENED];
    const weightByWindow = new Map<string, { weight: number; name: string }>();
    for (const w of windows) {
      assertSchoolInScope(user, w.schoolId ?? null);
      if (w.academicYearId !== dto.academicYearId || w.termId !== dto.termId) {
        throw new BadRequestException(`Window "${w.name}" is not in the selected term/year.`);
      }
      if (!usable.includes(w.status)) {
        throw new BadRequestException(`Window "${w.name}" has no computed results yet (status ${w.status}). Close/compute it first.`);
      }
      if (w._count.results === 0) {
        throw new BadRequestException(`Window "${w.name}" has no merit results to compose. Compute it first.`);
      }
      const sel = dto.windows.find((s) => s.examWindowId === w.id);
      const weight = sel?.weight ?? (windows.length === 1 ? 100 : w.weight ?? w.examType?.defaultWeight ?? 0);
      weightByWindow.set(w.id, { weight, name: w.name });
    }

    const check = validateWeights([...weightByWindow.values()].map((w) => w.weight));
    if (!check.ok) throw new BadRequestException(check.message);

    // Results older than the latest marks / exemptions must be recalculated before they feed a report card.
    for (const w of windows) {
      if (!w.computedAt) continue;
      const [staleMarks, staleExemptions] = await Promise.all([
        this.prisma.mark.count({
          where: { assessment: { examWindowId: w.id }, OR: [{ lastEditedAt: { gt: w.computedAt } }, { enteredAt: { gt: w.computedAt } }] },
        }),
        this.prisma.resultCalculationExemption.count({
          where: { termId: w.termId, academicYearId: w.academicYearId, OR: [{ examWindowId: null }, { examWindowId: w.id }], updatedAt: { gt: w.computedAt } },
        }),
      ]);
      const staleSubjects = w.subjectsChangedAt && w.subjectsChangedAt > w.computedAt;
      if (staleMarks || staleExemptions || staleSubjects) {
        throw new BadRequestException(`Window "${w.name}" has marks, exemptions or subjects changed since it was last calculated. Recalculate it before composing report cards.`);
      }
    }
    return { windows, weightByWindow };
  }

  async compose(dto: ComposeReportCardsDto, user: RequestUser) {
    const { windows, weightByWindow } = await this.resolveWindows(dto, user);
    // Group users without an active school: the selected windows already pin the school.
    let schoolId: string;
    try {
      schoolId = requireWriteSchoolId(user, 'report card composition');
    } catch (err) {
      const ids = [...new Set(windows.map((w) => w.schoolId))];
      if (ids.length !== 1 || !ids[0]) throw err;
      schoolId = ids[0];
    }
    const windowIds = windows.map((w) => w.id);

    const assessments = await this.prisma.assessment.findMany({
      where: { examWindowId: { in: windowIds } },
      include: { classSubject: { include: { subject: true } } },
    });
    const csMeta = new Map<string, ClassSubjectMeta>();
    for (const a of assessments) {
      csMeta.set(`${a.classId}:${a.subjectId}`, {
        classSubjectId: a.classSubjectId,
        subjectName: a.classSubject.subject.name,
        teacherId: a.classSubject.teacherId,
        combinationId: a.classSubject.combinationId,
        educationStage: a.educationStage,
        classLevel: a.classLevel,
      });
    }

    const where: Prisma.ExamWindowResultWhereInput = {
      examWindowId: { in: windowIds },
      classLevel: dto.scopeLevel,
      ...(dto.scopeClassIds?.length ? { classId: { in: dto.scopeClassIds } } : {}),
    };
    const results = await this.prisma.examWindowResult.findMany({ where });
    if (!results.length) {
      throw new BadRequestException('No merit results match the selected windows and scope.');
    }

    const byStudent = new Map<string, typeof results>();
    for (const r of results) {
      const arr = byStudent.get(r.studentId) ?? [];
      arr.push(r);
      byStudent.set(r.studentId, arr as any);
    }

    const academicYearId = dto.academicYearId;
    const scaleCache = new Map<string, any>();
    const scaleFor = async (stage: string | null, level: number | null, subjectId: string | null) => {
      const key = `${stage}:${level}:${subjectId}`;
      if (scaleCache.has(key)) return scaleCache.get(key);
      const scale = await this.grading.getActiveScale(academicYearId, { educationStage: stage, classLevel: level, subjectId }, schoolId);
      scaleCache.set(key, scale);
      return scale;
    };

    // ── Blend each student's subjects across the selected windows ──────────
    const rows: BlendedRow[] = [];
    for (const [studentId, studentResults] of byStudent.entries()) {
      const primary = [...studentResults].sort((a, b) => (b.computedAt?.getTime() ?? 0) - (a.computedAt?.getTime() ?? 0))[0];
      const classId = primary.classId;
      const classLevel = primary.classLevel;
      const stage = primary.educationStage;

      const perSubject = new Map<string, WindowContribution[]>();
      for (const res of studentResults) {
        const w = weightByWindow.get(res.examWindowId);
        if (!w) continue;
        const scores = res.subjectScores as unknown as Record<string, any>;
        for (const key of Object.keys(scores ?? {})) {
          const outcome = readOutcome(scores[key]);
          const arr = perSubject.get(outcome.subjectId) ?? [];
          arr.push({ examWindowId: res.examWindowId, name: w.name, weight: w.weight, outcome });
          perSubject.set(outcome.subjectId, arr);
        }
      }

      for (const [subjectId, contribs] of perSubject.entries()) {
        const meta = csMeta.get(`${classId}:${subjectId}`);
        if (!meta) continue;
        const blend = blendWindows(contribs);
        if (blend.status === 'MISSING') {
          throw new BadRequestException(
            `${primary.studentName ?? studentId} is missing a ${meta.subjectName} result in a selected window. Resolve it before composing report cards.`,
          );
        }
        const scale = await scaleFor(stage, classLevel, subjectId);
        const isExempt = blend.status === 'EXEMPT';
        const resolved = isExempt
          ? { grade: 'EXEMPT', points: 0, remark: 'Exempt', isPassing: true }
          : resolveBand(scale, blend.percentage ?? 0);
        rows.push({
          studentId,
          classId,
          classLevel,
          educationStage: stage,
          academicYearId,
          subjectId,
          subjectName: contribs[0].outcome.subjectName,
          classSubjectId: meta.classSubjectId,
          teacherId: meta.teacherId,
          combinationId: meta.combinationId,
          status: blend.status,
          blended: blend.percentage ?? 0,
          contributions: blend.contributions,
          grade: resolved.grade,
          points: resolved.points,
          remark: !isExempt && blend.status !== 'SCORED' ? (blend.status === 'NOT_SAT' ? 'Not sat' : 'Absent') : resolved.remark,
          isPassing: !isExempt && blend.status !== 'SCORED' ? false : resolved.isPassing,
          countsTowardAggregate: contribs.some((contribution) => contribution.outcome.countsTowardAggregate !== false),
        });
      }
    }

    if (!rows.length) {
      throw new BadRequestException('Nothing to compose — the selected windows have no subjects linked to classes in scope.');
    }

    // ── Per-subject rank within class (exempt rows are not ranked) ─────────
    const reportPolicy = await this.reportCardPolicy.getForSchool(schoolId);
    if (reportPolicy.autoAlternativeSubjectExemptions) {
      const rowsByStudent = new Map<string, BlendedRow[]>();
      for (const row of rows) {
        const current = rowsByStudent.get(row.studentId) ?? [];
        current.push(row);
        rowsByStudent.set(row.studentId, current);
      }
      for (const [studentId, studentRows] of rowsByStudent.entries()) {
        const decision = this.reportCardPolicy.alternativeDecision(studentRows);
        if (decision.conflicts.length) {
          throw new BadRequestException(
            `Student ${studentId} has scored results in both alternative subjects. Resolve the subject assignment before composing report cards.`,
          );
        }
        const exemptSubjectIds = new Set(decision.exemptSubjectIds);
        for (const row of studentRows) {
          if (!exemptSubjectIds.has(row.subjectId)) continue;
          row.status = 'EXEMPT';
          row.blended = 0;
          row.grade = 'EXEMPT';
          row.points = 0;
          row.remark = 'Exempt';
          row.isPassing = true;
        }
      }
    }

    const groups = new Map<string, BlendedRow[]>();
    for (const r of rows) {
      if (r.status === 'EXEMPT') continue;
      const key = `${r.classId}:${r.subjectId}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    for (const arr of groups.values()) {
      const sorted = [...arr].sort((a, b) => b.blended - a.blended);
      let prev: number | null = null;
      let prevRank = 0;
      sorted.forEach((r, i) => {
        const rank = prev !== null && r.blended === prev ? prevRank : i + 1;
        r.rank = rank;
        prevRank = rank;
        prev = r.blended;
      });
    }

    const classStudentCount = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!classStudentCount.has(r.classId)) classStudentCount.set(r.classId, new Set());
      classStudentCount.get(r.classId)!.add(r.studentId);
    }
    const classIds = [...classStudentCount.keys()];

    // Published report cards are never silently overwritten: unpublish first (audited).
    const published = await this.prisma.reportCard.count({ where: { classId: { in: classIds }, termId: dto.termId, isPublished: true } });
    if (published) {
      throw new BadRequestException(
        `${published} report card(s) in this term are already published. Unpublish the class results first, then compose again.`,
      );
    }

    // ── Upsert TermResult rows + drop stale composed rows (one atomic write) ──
    const keep = new Set(rows.map((r) => `${r.studentId}:${r.classSubjectId}`));
    const existing = await this.prisma.termResult.findMany({
      where: { classId: { in: classIds }, termId: dto.termId, studentId: { in: [...byStudent.keys()] } },
      select: { id: true, studentId: true, classSubjectId: true, assessmentScores: true },
    });
    const staleIds = existing
      .filter((e) => !keep.has(`${e.studentId}:${e.classSubjectId}`) && (e.assessmentScores as any)?.composedFrom !== undefined)
      .map((e) => e.id);

    const scoreJson = (r: BlendedRow) =>
      ({
        composedFrom: r.contributions,
        blended: r.blended,
        status: r.status,
        countsTowardAggregate: r.countsTowardAggregate,
      }) as unknown as Prisma.InputJsonValue;

    await this.prisma.$transaction(
      [
        ...(staleIds.length ? [this.prisma.termResult.deleteMany({ where: { id: { in: staleIds } } })] : []),
        ...rows.map((r) =>
          this.prisma.termResult.upsert({
            where: { studentId_classSubjectId_termId: { studentId: r.studentId, classSubjectId: r.classSubjectId, termId: dto.termId } },
            create: {
              studentId: r.studentId,
              classId: r.classId,
              classSubjectId: r.classSubjectId,
              subjectId: r.subjectId,
              subjectName: r.subjectName,
              educationStage: r.educationStage as any,
              classLevel: r.classLevel,
              combinationId: r.combinationId,
              termId: dto.termId,
              academicYearId: r.academicYearId,
              schoolId,
              assessmentScores: scoreJson(r),
              weightedTotal: r.blended,
              resultStatus: r.status,
              grade: r.grade,
              gradePoints: r.points,
              remark: r.remark,
              isPassing: r.isPassing,
              rank: r.rank ?? null,
              totalStudentsInClass: classStudentCount.get(r.classId)!.size,
              teacherId: r.teacherId,
            },
            update: {
              educationStage: r.educationStage as any,
              classLevel: r.classLevel,
              combinationId: r.combinationId,
              assessmentScores: scoreJson(r),
              weightedTotal: r.blended,
              resultStatus: r.status,
              grade: r.grade,
              gradePoints: r.points,
              remark: r.remark,
              isPassing: r.isPassing,
              rank: r.rank ?? null,
              totalStudentsInClass: classStudentCount.get(r.classId)!.size,
              teacherId: r.teacherId,
            },
          }),
        ),
      ],
    );

    // ── Reuse the existing generator to build ReportCards + PDFs per class ─
    let reportCardsGenerated = 0;
    const failures: string[] = [];
    const examLabel = dto.name?.trim()
      || [...new Set(windows.map((window) => window.name.trim()).filter(Boolean))].join(' + ');
    for (const classId of classIds) {
      try {
        const res = await this.reportCards.generateForClassTerm(classId, dto.termId, user.id, { examLabel });
        reportCardsGenerated += Number((res as any)?.generated ?? 0);
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        failures.push(`${classId}: ${msg}`);
        this.logger.warn(`Report card generation failed for class ${classId}: ${msg}`);
      }
    }
    if (failures.length && reportCardsGenerated === 0) {
      throw new BadRequestException(`Report cards could not be generated. ${failures[0]}`);
    }

    // ── Optional publish ──────────────────────────────────────────────────
    if (dto.publish) {
      await this.prisma.$transaction([
        this.prisma.termResult.updateMany({
          where: { classId: { in: classIds }, termId: dto.termId },
          data: { isPublished: true, publishedAt: new Date(), publishedById: user.id },
        }),
        this.prisma.reportCard.updateMany({
          where: { classId: { in: classIds }, termId: dto.termId },
          data: { isPublished: true, publishedAt: new Date(), publishedById: user.id },
        }),
      ]);

      const cards = await this.prisma.reportCard.findMany({
        where: { classId: { in: classIds }, termId: dto.termId },
        select: { classId: true, studentId: true, educationStage: true, overallAverage: true, failingSubjectCount: true },
      });
      const byClass = new Map<string, typeof cards>();
      for (const c of cards) {
        const arr = byClass.get(c.classId) ?? [];
        arr.push(c);
        byClass.set(c.classId, arr as any);
      }
      for (const [classId, group] of byClass.entries()) {
        const avg = group.reduce((s, c) => s + c.overallAverage, 0) / Math.max(group.length, 1);
        const passRate = (
          group.filter((card) => card.overallAverage >= this.reportCardPolicy.passMarkForStage(reportPolicy, card.educationStage)).length
          / Math.max(group.length, 1)
        ) * 100;
        await this.rabbitMq.publish('results.published', {
          classId,
          termId: dto.termId,
          academicYearId: dto.academicYearId,
          studentIds: group.map((c) => c.studentId),
          source: 'report-card-composition',
          schoolId,
        });
        await this.rabbitMq.publish('academic.results.finalized', {
          classId,
          termId: dto.termId,
          academicYearId: dto.academicYearId,
          source: 'report-card-composition',
          value: Number(passRate.toFixed(2)),
          summary: { totalStudents: group.length, averageScore: Number(avg.toFixed(2)), passRate: Number(passRate.toFixed(2)) },
          schoolId,
        });
      }
    }

    const composition = await this.prisma.reportCardComposition.create({
      data: {
        schoolId,
        name: dto.name,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        scopeLevel: dto.scopeLevel ?? null,
        scopeClassIds: dto.scopeClassIds ?? [],
        windowSelections: windows.map((w) => ({
          examWindowId: w.id,
          name: w.name,
          weight: weightByWindow.get(w.id)!.weight,
        })) as unknown as Prisma.InputJsonValue,
        status: 'GENERATED',
        classesGenerated: classIds.length,
        studentsGenerated: byStudent.size,
        reportCardsGenerated,
        generatedById: user.id,
        generatedAt: new Date(),
      },
    });

    await this.rabbitMq.publish('reportcard.composed', {
      compositionId: composition.id,
      termId: dto.termId,
      academicYearId: dto.academicYearId,
      classes: classIds.length,
      students: byStudent.size,
      published: !!dto.publish,
      schoolId,
    });

    return {
      composition,
      windowsUsed: windows.map((w) => ({ id: w.id, name: w.name, weight: weightByWindow.get(w.id)!.weight })),
      classes: classIds.length,
      students: byStudent.size,
      termResultsWritten: rows.length,
      exemptSubjects: rows.filter((r) => r.status === 'EXEMPT').length,
      reportCardsGenerated,
      warnings: failures,
      published: !!dto.publish,
    };
  }

  async list(termId: string | undefined, user: RequestUser) {
    return this.prisma.reportCardComposition.findMany({
      where: { ...schoolScopeFilter(user), termId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(id: string, user: RequestUser) {
    const composition = await this.prisma.reportCardComposition.findUnique({ where: { id } });
    if (!composition) throw new NotFoundException('Composition not found');
    assertSchoolInScope(user, composition.schoolId ?? null);
    return composition;
  }
}
