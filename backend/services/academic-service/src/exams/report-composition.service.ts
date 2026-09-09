import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExamWindowStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, resolveWriteSchoolId, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { GradingResolverService } from './grading-resolver.service';
import { ComposeReportCardsDto } from './dto/compose-report-cards.dto';

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  code: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  points: number;
  isAbsent: boolean;
  missing: boolean;
}

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
  blended: number;
  contributions: Array<{ examWindowId: string; name: string; weight: number; percentage: number }>;
  grade: string;
  points: number;
  remark: string;
  isPassing: boolean;
  rank?: number;
}

@Injectable()
export class ReportCompositionService {
  private readonly logger = new Logger(ReportCompositionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly grading: GradingResolverService,
    private readonly reportCards: ReportCardsService,
  ) {}

  private round(n: number, dp = 2): number {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
  }

  /** Validate the selected windows and resolve their effective weights. */
  private async resolveWindows(dto: ComposeReportCardsDto, user: RequestUser) {
    const ids = dto.windows.map((w) => w.examWindowId);
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
      const weight = sel?.weight ?? w.weight ?? w.examType?.defaultWeight ?? 100;
      weightByWindow.set(w.id, { weight, name: w.name });
    }
    return { windows, weightByWindow };
  }

  async compose(dto: ComposeReportCardsDto, user: RequestUser) {
    const schoolId = resolveWriteSchoolId(user);
    const { windows, weightByWindow } = await this.resolveWindows(dto, user);
    const windowIds = windows.map((w) => w.id);

    // Class-subject map: (classId:subjectId) -> classSubject metadata, from the
    // windows' assessments (the authoritative link subject↔class↔teacher).
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

    // Merit results across the selected windows, narrowed to scope.
    const where: Prisma.ExamWindowResultWhereInput = {
      examWindowId: { in: windowIds },
      classLevel: dto.scopeLevel,
      ...(dto.scopeClassIds?.length ? { classId: { in: dto.scopeClassIds } } : {}),
    };
    const results = await this.prisma.examWindowResult.findMany({ where });
    if (!results.length) {
      throw new BadRequestException('No merit results match the selected windows and scope.');
    }

    // Group per student.
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
      // Use the most recently computed result for class identity.
      const primary = [...studentResults].sort((a, b) => (b.computedAt?.getTime() ?? 0) - (a.computedAt?.getTime() ?? 0))[0];
      const classId = primary.classId;
      const classLevel = primary.classLevel;
      const stage = primary.educationStage;

      // Collect per-subject contributions across windows.
      const perSubject = new Map<string, { num: number; den: number; name: string; code: string; contributions: BlendedRow['contributions'] }>();
      for (const res of studentResults) {
        const w = weightByWindow.get(res.examWindowId);
        if (!w) continue;
        const scores = res.subjectScores as unknown as Record<string, SubjectScore>;
        for (const key of Object.keys(scores ?? {})) {
          const s = scores[key];
          const entry = perSubject.get(s.subjectId) ?? { num: 0, den: 0, name: s.subjectName, code: s.code, contributions: [] };
          entry.num += s.percentage * w.weight;
          entry.den += w.weight;
          entry.contributions.push({ examWindowId: res.examWindowId, name: w.name, weight: w.weight, percentage: s.percentage });
          perSubject.set(s.subjectId, entry);
        }
      }

      for (const [subjectId, agg] of perSubject.entries()) {
        const meta = csMeta.get(`${classId}:${subjectId}`);
        if (!meta) {
          // Subject not linked to a class-subject in these windows — skip defensively.
          continue;
        }
        const blended = agg.den > 0 ? this.round(agg.num / agg.den) : 0;
        const scale = await scaleFor(stage, classLevel, subjectId);
        const resolved = this.grading.resolveGrade(scale, blended);
        rows.push({
          studentId,
          classId,
          classLevel,
          educationStage: stage,
          academicYearId,
          subjectId,
          subjectName: agg.name,
          classSubjectId: meta.classSubjectId,
          teacherId: meta.teacherId,
          combinationId: meta.combinationId,
          blended,
          contributions: agg.contributions,
          grade: resolved.grade,
          points: resolved.points,
          remark: resolved.remark,
          isPassing: resolved.isPassing,
        });
      }
    }

    if (!rows.length) {
      throw new BadRequestException('Nothing to compose — the selected windows have no subjects linked to classes in scope.');
    }

    // ── Per-subject rank within class ─────────────────────────────────────
    const groups = new Map<string, BlendedRow[]>();
    for (const r of rows) {
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
        let rank = i + 1;
        if (prev !== null && r.blended === prev) rank = prevRank;
        r.rank = rank;
        prevRank = rank;
        prev = r.blended;
      });
    }

    // ── Upsert TermResult rows (the report-card generator reads these) ─────
    const classStudentCount = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!classStudentCount.has(r.classId)) classStudentCount.set(r.classId, new Set());
      classStudentCount.get(r.classId)!.add(r.studentId);
    }

    await this.prisma.$transaction(
      rows.map((r) =>
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
            assessmentScores: { composedFrom: r.contributions, blended: r.blended } as unknown as Prisma.InputJsonValue,
            weightedTotal: r.blended,
            grade: r.grade,
            gradePoints: r.points,
            remark: r.remark,
            isPassing: r.isPassing,
            rank: r.rank,
            totalStudentsInClass: classStudentCount.get(r.classId)!.size,
            teacherId: r.teacherId,
          },
          update: {
            educationStage: r.educationStage as any,
            classLevel: r.classLevel,
            combinationId: r.combinationId,
            assessmentScores: { composedFrom: r.contributions, blended: r.blended } as unknown as Prisma.InputJsonValue,
            weightedTotal: r.blended,
            grade: r.grade,
            gradePoints: r.points,
            remark: r.remark,
            isPassing: r.isPassing,
            rank: r.rank,
            totalStudentsInClass: classStudentCount.get(r.classId)!.size,
            teacherId: r.teacherId,
          },
        }),
      ),
    );

    // ── Reuse the existing generator to build ReportCards + PDFs per class ─
    const classIds = [...classStudentCount.keys()];
    let reportCardsGenerated = 0;
    for (const classId of classIds) {
      try {
        const res = await this.reportCards.generateForClassTerm(classId, dto.termId, user.id);
        reportCardsGenerated += Number((res as any)?.generated ?? 0);
      } catch (err) {
        this.logger.warn(`Report card generation failed for class ${classId}: ${(err as Error)?.message ?? err}`);
      }
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

      // Linkage: feed analytics + the perf engine's attendance-correlation pass
      // via the legacy event contracts (per composed class).
      const cards = await this.prisma.reportCard.findMany({
        where: { classId: { in: classIds }, termId: dto.termId },
        select: { classId: true, studentId: true, overallAverage: true, failingSubjectCount: true },
      });
      const byClass = new Map<string, typeof cards>();
      for (const c of cards) {
        const arr = byClass.get(c.classId) ?? [];
        arr.push(c);
        byClass.set(c.classId, arr as any);
      }
      for (const [classId, group] of byClass.entries()) {
        const avg = group.reduce((s, c) => s + c.overallAverage, 0) / Math.max(group.length, 1);
        const passRate = (group.filter((c) => c.failingSubjectCount === 0).length / Math.max(group.length, 1)) * 100;
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

    // ── Persist the composition for audit / repeatability ─────────────────
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
      reportCardsGenerated,
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
