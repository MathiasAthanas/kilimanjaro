import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Prisma, TermResult } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { PublishResultsDto } from './dto/publish-results.dto';
import { ResultsFilterDto } from './dto/results-filter.dto';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { AccessControlService } from '../common/helpers/access-control.service';
import { resolveBand } from '../exams/engine/result-engine';
import { resolveExpectedStudents } from '../exams/engine/expected-students';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly studentClient: StudentClientService,
    private readonly accessControl: AccessControlService,
    @Optional() @Inject(forwardRef(() => ReportCardsService))
    private readonly reportCardsService?: ReportCardsService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  private assignCompetitionRanks(entries: { studentId: string; score: number }[]): Record<string, number> {
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    let previousScore: number | null = null;
    let previousRank = 0;

    const ranks: Record<string, number> = {};
    sorted.forEach((entry, index) => {
      let rank = index + 1;
      if (previousScore !== null && entry.score === previousScore) {
        rank = previousRank;
      }

      ranks[entry.studentId] = rank;
      previousRank = rank;
      previousScore = entry.score;
    });

    return ranks;
  }

  private async getActiveScale(
    academicYearId: string,
    scope: { educationStage?: string | null; classLevel?: number | null; subjectId?: string | null } = {},
    schoolId?: string | null,
  ) {
    // Include schoolId in cache key so different schools never share a cached scale.
    const cacheKey = `grading-scale:active:${schoolId ?? 'global'}:${academicYearId}:${scope.educationStage ?? 'ALL'}:${scope.classLevel ?? 'ALL'}:${scope.subjectId ?? 'ALL'}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const candidates = await this.prisma.gradingScale.findMany({
      where: {
        academicYearId,
        isActive: true,
        // Prefer school-specific scale; fall back to global (schoolId = null).
        AND: [
          schoolId
            ? { OR: [{ schoolId }, { schoolId: null }] }
            : { schoolId: null },
          {
            OR: [
              { educationStage: scope.educationStage as any, classLevel: scope.classLevel ?? null, subjectId: scope.subjectId ?? null },
              { educationStage: scope.educationStage as any, classLevel: scope.classLevel ?? null, subjectId: null },
              { educationStage: scope.educationStage as any, classLevel: null, subjectId: null },
              { educationStage: null, classLevel: null, subjectId: null },
            ],
          },
        ],
      },
      include: { grades: { orderBy: { minScore: 'asc' } } },
    });

    const scale = candidates.sort((a, b) => {
      const score = (item: typeof a) =>
        (item.schoolId ? 8 : 0) +
        (item.subjectId ? 4 : 0) +
        (item.classLevel !== null ? 2 : 0) +
        (item.educationStage ? 1 : 0);
      return score(b) - score(a);
    })[0];

    if (!scale) {
      throw new BadRequestException(`No active grading scale for academicYearId ${academicYearId}`);
    }

    await this.redis.set(cacheKey, scale, 3600);
    return scale;
  }

  private resolveGrade(scale: any, score: number) {
    // One gap-proof resolver for every grade in the system.
    return resolveBand(scale, score);
  }

  async computeTermResults(classSubjectId: string, termId: string) {
    const assessments = await this.prisma.assessment.findMany({
      // Legacy weighted term-result path only: exam-window assessments (which have
      // a null assessmentTypeId) are ranked via ExamWindowResult instead.
      where: { classSubjectId, termId, status: 'LOCKED', assessmentTypeId: { not: null } },
      include: { assessmentType: true, classSubject: { include: { subject: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (!assessments.length) {
      return { computed: 0, reason: 'No locked assessments' };
    }

    const first = assessments[0];
    const scale = await this.getActiveScale(
      first.academicYearId,
      {
        educationStage: first.classSubject.educationStage,
        classLevel: first.classSubject.classLevel,
        subjectId: first.subjectId,
      },
      (first as any).schoolId ?? null,
    );

    const studentIdsPayload = await this.studentClient.get<any>(`/students/internal/class/${first.classId}/student-ids`);
    const classStudentIds = this.unwrap<string[]>(studentIdsPayload) || [];
    // Only students who take this subject are calculated; exempt students are recorded as EXEMPT.
    const { expected, exempt } = await resolveExpectedStudents(
      this.prisma,
      { ...(first as any), examWindowId: null, classSubject: first.classSubject as any },
      classStudentIds,
    );
    const studentIds = classStudentIds.filter((id) => expected.has(id));

    const marks = await this.prisma.mark.findMany({
      where: { assessmentId: { in: assessments.map((item) => item.id) } },
    });

    const marksMap = new Map<string, Map<string, number>>();
    for (const mark of marks) {
      if (!marksMap.has(mark.studentId)) {
        marksMap.set(mark.studentId, new Map());
      }
      marksMap.get(mark.studentId)!.set(mark.assessmentId, mark.score);
    }

    // A student with no mark for an assessment is NOT a silent zero: calculation is blocked until
    // a score is entered, or the student is marked ABSENT / NOT SAT, or an exemption is approved.
    const unresolved = studentIds.filter((id) => !exempt.has(id) && assessments.some((a) => !marksMap.get(id)?.has(a.id)));
    if (unresolved.length) {
      throw new BadRequestException(
        `${unresolved.length} student(s) have no ${first.classSubject.subject.name} mark. ` +
          'Enter a score, mark the student ABSENT/NOT SAT, or approve an exemption.',
      );
    }

    const computedRows: Array<{
      studentId: string;
      weightedTotal: number;
      breakdown: Record<string, number>;
      exempt?: boolean;
    }> = [];

    for (const studentId of studentIds) {
      if (exempt.has(studentId)) {
        computedRows.push({ studentId, weightedTotal: 0, breakdown: {}, exempt: true });
        continue;
      }
      const map = marksMap.get(studentId) ?? new Map();
      const breakdown: Record<string, number> = {};

      let weightedTotal = 0;
      for (const assessment of assessments) {
        const score = map.get(assessment.id) ?? 0;
        const normalized = (score / assessment.maxScore) * 100;
        const weightPercentage = assessment.assessmentType?.weightPercentage ?? 0;
        const contribution = normalized * (weightPercentage / 100);
        weightedTotal += contribution;
        if (assessment.assessmentType?.code) {
          breakdown[assessment.assessmentType.code] = score;
        }
      }

      computedRows.push({ studentId, weightedTotal: Number(weightedTotal.toFixed(2)), breakdown });
    }

    const ranking = this.assignCompetitionRanks(
      computedRows.filter((row) => !row.exempt).map((row) => ({ studentId: row.studentId, score: row.weightedTotal })),
    );

    const upsertOps = computedRows.map((row) => {
      const resolved = row.exempt
        ? { grade: 'EXEMPT', points: 0, remark: 'Exempt', isPassing: true }
        : this.resolveGrade(scale, row.weightedTotal);
      return this.prisma.termResult.upsert({
        where: {
          studentId_classSubjectId_termId: {
            studentId: row.studentId,
            classSubjectId,
            termId,
          },
        },
        create: {
          studentId: row.studentId,
          classId: first.classId,
          classSubjectId,
          subjectId: first.subjectId,
          subjectName: first.classSubject.subject.name,
          educationStage: first.classSubject.educationStage,
          classLevel: first.classSubject.classLevel,
          combinationId: first.classSubject.combinationId,
          termId,
          academicYearId: first.academicYearId,
          schoolId: (first as any).schoolId ?? null,
          assessmentScores: row.breakdown,
          weightedTotal: row.weightedTotal,
          resultStatus: row.exempt ? 'EXEMPT' : 'SCORED',
          grade: resolved.grade,
          gradePoints: resolved.points,
          remark: resolved.remark,
          isPassing: resolved.isPassing,
          rank: row.exempt ? null : ranking[row.studentId],
          totalStudentsInClass: studentIds.length,
          teacherId: first.classSubject.teacherId,
        },
        update: {
          educationStage: first.classSubject.educationStage,
          classLevel: first.classSubject.classLevel,
          combinationId: first.classSubject.combinationId,
          assessmentScores: row.breakdown,
          weightedTotal: row.weightedTotal,
          resultStatus: row.exempt ? 'EXEMPT' : 'SCORED',
          grade: resolved.grade,
          gradePoints: resolved.points,
          remark: resolved.remark,
          isPassing: resolved.isPassing,
          rank: row.exempt ? null : ranking[row.studentId],
          totalStudentsInClass: studentIds.length,
          teacherId: first.classSubject.teacherId,
        },
      });
    });

    // All upserts in one atomic transaction — partial failure leaves no half-written class results.
    const results = await this.prisma.$transaction(upsertOps);

    for (const result of results) {
      if (result.resultStatus === 'EXEMPT') continue;
      await this.rabbitMq.publish('performance.snapshot.ready', {
        studentId: result.studentId,
        subjectId: result.subjectId,
        subjectName: result.subjectName,
        classId: result.classId,
        termId: result.termId,
        academicYearId: result.academicYearId,
        score: result.weightedTotal,
        grade: result.grade,
        assessmentBreakdown: result.assessmentScores,
        rank: result.rank,
        totalStudentsInClass: result.totalStudentsInClass,
        teacherId: result.teacherId,
      });
    }

    await this.redis.del(`class-results:${first.classId}:${termId}`);
    await this.redis.delByPattern(`student-results:*:${termId}`);

    return {
      computed: results.length,
      classSubjectId,
      termId,
    };
  }

  async listResults(filters: ResultsFilterDto, user?: RequestUser) {
    const where: Prisma.TermResultWhereInput = {
      ...schoolScopeFilter(user),
      studentId: filters.studentId,
      classId: filters.classId,
      termId: filters.termId,
      academicYearId: filters.academicYearId,
      subjectId: filters.subjectId,
      isPublished: filters.isPublished === undefined ? undefined : filters.isPublished === 'true',
    };

    if (user?.role === ROLES.STUDENT || user?.role === ROLES.PARENT) {
      where.isPublished = true;
      if (user.role === ROLES.STUDENT) {
        const studentId = await this.accessControl.resolveStudentIdForAuthUser(user.id);
        if (!studentId) {
          return [];
        }
        where.studentId = studentId;
      }

      if (user.role === ROLES.PARENT) {
        const studentIds = await this.accessControl.resolveGuardianStudentIds(user.id);
        if (filters.studentId) {
          await this.accessControl.assertParentOwnsStudent(user.id, filters.studentId);
          where.studentId = filters.studentId;
        } else {
          where.studentId = studentIds.length ? { in: studentIds } : '__none__';
        }
      }
    }

    return this.prisma.termResult.findMany({ where, orderBy: [{ classId: 'asc' }, { weightedTotal: 'desc' }] });
  }

  async classResults(classId: string, termId: string) {
    const cacheKey = `class-results:${classId}:${termId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await this.prisma.termResult.findMany({ where: { classId, termId }, orderBy: { weightedTotal: 'desc' } });

    const groupedBySubject = new Map<string, TermResult[]>();
    for (const row of results) {
      // Exempt subjects stay visible in `items` but never distort subject averages / top-bottom.
      if (row.resultStatus === 'EXEMPT') continue;
      if (!groupedBySubject.has(row.subjectId)) {
        groupedBySubject.set(row.subjectId, []);
      }
      groupedBySubject.get(row.subjectId)!.push(row);
    }

    const subjectStats = [...groupedBySubject.entries()].map(([subjectId, items]) => {
      const avg = items.reduce((sum, item) => sum + item.weightedTotal, 0) / Math.max(items.length, 1);
      return {
        subjectId,
        subjectName: items[0]?.subjectName,
        average: Number(avg.toFixed(2)),
        topStudent: items[0]?.studentId,
        bottomStudent: items[items.length - 1]?.studentId,
      };
    });

    const alertsPayload = await this.studentClient.get<any>(
        '/students/performance/summary/class/' + classId,
      { termId },
      { 'X-User-Id': 'academic-service', 'X-User-Role': ROLES.PRINCIPAL },
    );

    const response = {
      classId,
      termId,
      totalResults: results.length,
      subjectStats,
      performanceIntelligence: this.unwrap<any>(alertsPayload),
      items: results,
    };

    await this.redis.set(cacheKey, response, 900);
    return response;
  }

  /**
   * Withdraw published term results + report cards for a class/term so that
   * exemptions or marks can be corrected. Required before any change to
   * published results; they stay hidden from students/parents until republished.
   */
  async unpublishResults(dto: PublishResultsDto, user: RequestUser) {
    const publisherRoles = [ROLES.PRINCIPAL, ROLES.HEAD_OF_SCHOOL, ROLES.MANAGER, ROLES.SUPER_ADMIN];
    if (!publisherRoles.includes(user.role as any)) {
      throw new ForbiddenException('Only Principal, Head of School, Manager or Super Admin can unpublish results');
    }
    const [results, cards] = await this.prisma.$transaction([
      this.prisma.termResult.updateMany({
        where: { classId: dto.classId, termId: dto.termId, isPublished: true },
        data: { isPublished: false, publishedAt: null },
      }),
      this.prisma.reportCard.updateMany({
        where: { classId: dto.classId, termId: dto.termId, isPublished: true },
        data: { isPublished: false, publishedAt: null },
      }),
    ]);
    await this.prisma.academicAuditLog.create({
      data: {
        schoolId: (user as { activeSchoolId?: string | null }).activeSchoolId ?? null,
        action: 'RESULTS_UNPUBLISHED',
        performedById: user.id,
        payload: { classId: dto.classId, termId: dto.termId, termResults: results.count, reportCards: cards.count },
      },
    });
    await this.redis.del(`class-results:${dto.classId}:${dto.termId}`);
    await this.redis.delByPattern(`student-results:*:${dto.termId}`);
    await this.redis.delByPattern(`report-card:*:${dto.termId}`);
    await this.rabbitMq.publish('results.unpublished', { classId: dto.classId, termId: dto.termId });
    return { unpublished: true, termResults: results.count, reportCards: cards.count };
  }

  async publishResults(dto: PublishResultsDto, user: RequestUser) {
    const publisherRoles = [ROLES.PRINCIPAL, ROLES.HEAD_OF_SCHOOL, ROLES.MANAGER, ROLES.SUPER_ADMIN];
    if (!publisherRoles.includes(user.role as any)) {
      throw new ForbiddenException('Only Principal, Head of School, Manager or Super Admin can publish results');
    }

    const results = await this.prisma.termResult.findMany({ where: { classId: dto.classId, termId: dto.termId } });
    if (!results.length) {
      throw new BadRequestException('No computed results found for class/term');
    }

    const studentIds = [...new Set(results.map((item) => item.studentId))];
    const academicYearId = results[0].academicYearId;

    await this.prisma.termResult.updateMany({
      where: { classId: dto.classId, termId: dto.termId },
      data: { isPublished: true, publishedAt: new Date(), publishedById: user.id },
    });

    if (this.reportCardsService) {
      await this.reportCardsService.generateForClassTerm(dto.classId, dto.termId, user.id);
      await this.prisma.reportCard.updateMany({
        where: { classId: dto.classId, termId: dto.termId },
        data: { isPublished: true, publishedAt: new Date(), publishedById: user.id },
      });
    }

    await this.rabbitMq.publish('results.published', {
      classId: dto.classId,
      termId: dto.termId,
      studentIds,
      academicYearId,
    });

    // Exempt subjects never count toward the class average or pass rate.
    const counted = results.filter((item) => item.resultStatus !== 'EXEMPT');
    const classAverage =
      counted.reduce((sum, item) => sum + item.weightedTotal, 0) / Math.max(counted.length, 1);
    const passRate =
      (counted.filter((item) => item.isPassing).length / Math.max(counted.length, 1)) * 100;
    await this.rabbitMq.publish('academic.results.finalized', {
      classId: dto.classId,
      termId: dto.termId,
      summary: {
        totalStudents: studentIds.length,
        averageScore: Number(classAverage.toFixed(2)),
        passRate: Number(passRate.toFixed(2)),
      },
    });

    const highAlertsPayload = await this.studentClient.get<any>(
        '/students/performance/alerts',
      { classId: dto.classId, isResolved: false, severity: 'HIGH,CRITICAL' },
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );

    const alerts = this.unwrap<any>(highAlertsPayload);
    const alertItems = Array.isArray(alerts?.items) ? alerts.items : Array.isArray(alerts) ? alerts : [];

    const criticalStudents = alertItems
      .filter((item: any) => item.severity === 'CRITICAL')
      .map((item: any) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        alertType: item.alertType,
        subjectName: item.subjectName,
        score: item.score,
      }));

    const atRiskStudents = alertItems
      .filter((item: any) => item.severity === 'HIGH')
      .map((item: any) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        subjectName: item.subjectName,
        score: item.score,
      }));

    await this.redis.del(`class-results:${dto.classId}:${dto.termId}`);
    await this.redis.delByPattern(`student-results:*:${dto.termId}`);
    await this.redis.delByPattern(`report-card:*:${dto.termId}`);

    return {
      published: true,
      classId: dto.classId,
      termId: dto.termId,
      totalStudents: studentIds.length,
      performanceIntelligence: {
        newAlertsTriggered: alertItems.length,
        criticalStudents,
        atRiskStudents,
        improvingStudents: [],
        pairingSuggestionsCreated: 0,
        recommendedActions:
          criticalStudents.length > 0
            ? [`${criticalStudents.length} students require immediate intervention.`]
            : ['Continue regular monitoring and weekly intervention reviews.'],
      },
    };
  }

  async readiness(termId?: string) {
    const where = termId ? { termId } : {};
    const [totalResults, publishedResults, totalAssessments, gradedAssessments] = await Promise.all([
      this.prisma.termResult.count({ where }),
      this.prisma.termResult.count({ where: { ...where, isPublished: true } }),
      this.prisma.assessment.count({ where: termId ? { termId } : {} }),
      this.prisma.assessment.count({ where: { ...(termId ? { termId } : {}), status: 'LOCKED' } }),
    ]);
    const resultsReadiness = totalResults > 0 ? Math.round((publishedResults / totalResults) * 100) : 0;
    const gradingReadiness = totalAssessments > 0 ? Math.round((gradedAssessments / totalAssessments) * 100) : 0;
    return {
      termId: termId || null,
      results: { total: totalResults, published: publishedResults, unpublished: totalResults - publishedResults, readinessPercent: resultsReadiness },
      assessments: { total: totalAssessments, approved: gradedAssessments, pending: totalAssessments - gradedAssessments, readinessPercent: gradingReadiness },
      isReadyToPublish: gradingReadiness >= 80 && resultsReadiness < 100,
      checkedAt: new Date(),
    };
  }
}
