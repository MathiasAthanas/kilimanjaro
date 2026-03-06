import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Prisma, TermResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PublishResultsDto } from './dto/publish-results.dto';
import { ResultsFilterDto } from './dto/results-filter.dto';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { AccessControlService } from '../common/helpers/access-control.service';

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

  private async getActiveScale(academicYearId: string) {
    const cacheKey = `grading-scale:active:${academicYearId}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const scale = await this.prisma.gradingScale.findFirst({
      where: { academicYearId, isActive: true },
      include: { grades: { orderBy: { minScore: 'asc' } } },
    });

    if (!scale) {
      throw new BadRequestException(`No active grading scale for academicYearId ${academicYearId}`);
    }

    await this.redis.set(cacheKey, scale, 3600);
    return scale;
  }

  private resolveGrade(scale: any, score: number) {
    const grade = scale.grades.find((item: any) => score >= item.minScore && score <= item.maxScore);
    if (!grade) {
      return { grade: 'N/A', points: 0, remark: 'Not graded', isPassing: false };
    }

    return {
      grade: grade.grade,
      points: grade.points,
      remark: grade.remark,
      isPassing: grade.isPassing,
    };
  }

  async computeTermResults(classSubjectId: string, termId: string) {
    const assessments = await this.prisma.assessment.findMany({
      where: { classSubjectId, termId, status: 'LOCKED' },
      include: { assessmentType: true, classSubject: { include: { subject: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (!assessments.length) {
      return { computed: 0, reason: 'No locked assessments' };
    }

    const first = assessments[0];
    const scale = await this.getActiveScale(first.academicYearId);

    const studentIdsPayload = await this.studentClient.get<any>(`/students/internal/class/${first.classId}/student-ids`);
    const studentIds = this.unwrap<string[]>(studentIdsPayload) || [];

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

    const computedRows: Array<{
      studentId: string;
      weightedTotal: number;
      breakdown: Record<string, number>;
    }> = [];

    for (const studentId of studentIds) {
      const map = marksMap.get(studentId) ?? new Map();
      const breakdown: Record<string, number> = {};

      let weightedTotal = 0;
      for (const assessment of assessments) {
        const score = map.get(assessment.id) ?? 0;
        const normalized = (score / assessment.maxScore) * 100;
        const contribution = normalized * (assessment.assessmentType.weightPercentage / 100);
        weightedTotal += contribution;
        breakdown[assessment.assessmentType.code] = score;
      }

      computedRows.push({ studentId, weightedTotal: Number(weightedTotal.toFixed(2)), breakdown });
    }

    const ranking = this.assignCompetitionRanks(
      computedRows.map((row) => ({ studentId: row.studentId, score: row.weightedTotal })),
    );

    const upserts: Promise<TermResult>[] = [];
    for (const row of computedRows) {
      const resolved = this.resolveGrade(scale, row.weightedTotal);
      upserts.push(
        this.prisma.termResult.upsert({
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
            termId,
            academicYearId: first.academicYearId,
            assessmentScores: row.breakdown,
            weightedTotal: row.weightedTotal,
            grade: resolved.grade,
            gradePoints: resolved.points,
            remark: resolved.remark,
            isPassing: resolved.isPassing,
            rank: ranking[row.studentId],
            totalStudentsInClass: studentIds.length,
            teacherId: first.classSubject.teacherId,
          },
          update: {
            assessmentScores: row.breakdown,
            weightedTotal: row.weightedTotal,
            grade: resolved.grade,
            gradePoints: resolved.points,
            remark: resolved.remark,
            isPassing: resolved.isPassing,
            rank: ranking[row.studentId],
            totalStudentsInClass: studentIds.length,
            teacherId: first.classSubject.teacherId,
          },
        }),
      );
    }

    const results = await Promise.all(upserts);

    for (const result of results) {
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
      '/api/v1/students/performance/summary/class/' + classId,
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

  async publishResults(dto: PublishResultsDto, user: RequestUser) {
    if (user.role !== ROLES.PRINCIPAL) {
      throw new ForbiddenException('Only principal can publish results');
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

    const classAverage =
      results.reduce((sum, item) => sum + item.weightedTotal, 0) / Math.max(results.length, 1);
    const passRate =
      (results.filter((item) => item.isPassing).length / Math.max(results.length, 1)) * 100;
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
      '/api/v1/students/performance/alerts',
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
}
