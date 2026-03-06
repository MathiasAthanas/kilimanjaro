import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ApprovalAction, AssessmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { mean, median, stdDeviation } from '../common/helpers/statistics.helper';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { ResultsService } from '../results/results.service';
import { ApproveAssessmentDto } from './dto/approve-assessment.dto';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { GenerateAssessmentsDto } from './dto/generate-assessments.dto';
import { RejectAssessmentDto } from './dto/reject-assessment.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentClient: StudentClientService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    @Optional() @Inject(forwardRef(() => ResultsService)) private readonly resultsService?: ResultsService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  private ensureTeacherScope(user: RequestUser, teacherId: string): void {
    if (user.role === ROLES.TEACHER && user.id !== teacherId) {
      throw new ForbiddenException('Teacher can only access own assessments');
    }
  }

  private async assertHodSubjectScope(user: RequestUser, subjectId: string): Promise<void> {
    if (user.role !== ROLES.HEAD_OF_DEPARTMENT) {
      return;
    }

    const hasScope = await this.prisma.classSubject.findFirst({
      where: {
        subjectId,
        teacherId: user.id,
      },
      select: { id: true },
    });

    if (!hasScope) {
      throw new ForbiddenException('HOD cannot review assessments outside assigned subjects');
    }
  }

  private async getAssessmentOrThrow(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        classSubject: { include: { subject: true } },
        assessmentType: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    return assessment;
  }

  async generateAssessments(dto: GenerateAssessmentsDto) {
    const classSubjects = await this.prisma.classSubject.findMany({
      where: {
        academicYearId: dto.academicYearId,
        isActive: true,
        classId: dto.classIds?.length ? { in: dto.classIds } : undefined,
      },
      include: { subject: true },
    });

    const assessmentTypes = await this.prisma.assessmentType.findMany({
      where: { academicYearId: dto.academicYearId, isActive: true },
    });

    let created = 0;

    for (const classSubject of classSubjects) {
      for (const type of assessmentTypes) {
        const existing = await this.prisma.assessment.findUnique({
          where: {
            classSubjectId_assessmentTypeId_termId: {
              classSubjectId: classSubject.id,
              assessmentTypeId: type.id,
              termId: dto.termId,
            },
          },
        });

        if (existing) {
          continue;
        }

        await this.prisma.assessment.create({
          data: {
            classSubjectId: classSubject.id,
            assessmentTypeId: type.id,
            classId: classSubject.classId,
            subjectId: classSubject.subjectId,
            termId: dto.termId,
            academicYearId: dto.academicYearId,
            name: `${classSubject.subject.name} ${type.name} - ${dto.termId}`,
            status: AssessmentStatus.OPEN,
          },
        });

        created += 1;
      }
    }

    return { created, classSubjects: classSubjects.length, assessmentTypes: assessmentTypes.length };
  }

  async listAssessments(filters: {
    classId?: string;
    subjectId?: string;
    termId?: string;
    status?: AssessmentStatus;
    teacherId?: string;
  }, user?: RequestUser) {
    const teacherId = user?.role === ROLES.TEACHER ? user.id : filters.teacherId;

    return this.prisma.assessment.findMany({
      where: {
        classId: filters.classId,
        subjectId: filters.subjectId,
        termId: filters.termId,
        status: filters.status,
        classSubject: teacherId ? { teacherId } : undefined,
      },
      include: {
        classSubject: { include: { subject: true } },
        assessmentType: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getAssessment(id: string, user?: RequestUser) {
    const assessment = await this.getAssessmentOrThrow(id);
    if (user) {
      this.ensureTeacherScope(user, assessment.classSubject.teacherId);
    }

    return assessment;
  }

  async getMarksSheet(id: string, user: RequestUser) {
    const assessment = await this.getAssessmentOrThrow(id);
    this.ensureTeacherScope(user, assessment.classSubject.teacherId);

    const cacheKey = `marks-sheet:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const studentsPayload = await this.studentClient.get<any>(
      '/api/v1/students',
      { classId: assessment.classId, limit: 1000, page: 1 },
      { 'X-User-Id': user.id, 'X-User-Role': ROLES.PRINCIPAL },
    );

    const studentsData = this.unwrap<any>(studentsPayload);
    const students = Array.isArray(studentsData?.items) ? studentsData.items : [];

    const marks = await this.prisma.mark.findMany({
      where: { assessmentId: id },
      select: {
        id: true,
        studentId: true,
        score: true,
        isAbsent: true,
        note: true,
      },
    });

    const markMap = new Map(marks.map((item) => [item.studentId, item]));

    const rows = students.map((student: any) => {
      const existing = markMap.get(student.id);
      return {
        markId: existing?.id,
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        registrationNumber: student.registrationNumber,
        score: existing?.score ?? null,
        isAbsent: existing?.isAbsent ?? false,
        note: existing?.note ?? null,
      };
    });

    const result = { assessment, rows };
    await this.redis.set(cacheKey, result, 300);
    return result;
  }

  async bulkUpsertMarks(id: string, dto: BulkMarksDto, user: RequestUser) {
    const assessment = await this.getAssessmentOrThrow(id);
    this.ensureTeacherScope(user, assessment.classSubject.teacherId);

    if (!([AssessmentStatus.OPEN, AssessmentStatus.DRAFT, AssessmentStatus.REJECTED] as AssessmentStatus[]).includes(assessment.status)) {
      throw new BadRequestException('Assessment is not open for editing');
    }

    const normalizedMarks = dto.marks.map((item) => ({
      ...item,
      isAbsent: item.isAbsent ?? false,
      score: item.isAbsent ? 0 : item.score,
    }));

    for (const mark of normalizedMarks) {
      if (mark.score === undefined || mark.score === null) {
        throw new BadRequestException('Score is required when mark is not absent');
      }

      if (mark.score < 0 || mark.score > assessment.maxScore) {
        throw new BadRequestException(`Score for ${mark.studentId} must be between 0 and ${assessment.maxScore}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const entry of normalizedMarks) {
        await tx.mark.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: id,
              studentId: entry.studentId,
            },
          },
          create: {
            assessmentId: id,
            classSubjectId: assessment.classSubjectId,
            studentId: entry.studentId,
            score: entry.score!,
            isAbsent: entry.isAbsent,
            note: entry.note,
            enteredById: user.id,
          },
          update: {
            score: entry.score!,
            isAbsent: entry.isAbsent,
            note: entry.note,
            lastEditedById: user.id,
            lastEditedAt: new Date(),
          },
        });
      }

      await tx.assessment.update({
        where: { id },
        data: {
          status: AssessmentStatus.OPEN,
          updatedAt: new Date(),
        },
      });
    });

    await this.redis.del(`marks-sheet:${id}`, `class-results:${assessment.classId}:${assessment.termId}`);
    return { updatedCount: normalizedMarks.length };
  }

  async updateMark(assessmentId: string, markId: string, dto: UpdateMarkDto, user: RequestUser) {
    const assessment = await this.getAssessmentOrThrow(assessmentId);
    this.ensureTeacherScope(user, assessment.classSubject.teacherId);

    const mark = await this.prisma.mark.findUnique({ where: { id: markId } });
    if (!mark || mark.assessmentId !== assessmentId) {
      throw new NotFoundException('Mark not found');
    }

    if (mark.isLocked && ![ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL].includes(user.role as any)) {
      throw new ForbiddenException('Locked marks can only be edited by HOD or Principal');
    }

    const score = dto.isAbsent ? 0 : dto.score ?? mark.score;
    if (score < 0 || score > assessment.maxScore) {
      throw new BadRequestException(`Score must be between 0 and ${assessment.maxScore}`);
    }

    const updated = await this.prisma.mark.update({
      where: { id: markId },
      data: {
        score,
        isAbsent: dto.isAbsent ?? mark.isAbsent,
        note: dto.note ?? mark.note,
        lastEditedById: user.id,
        lastEditedAt: new Date(),
      },
    });

    if (mark.isLocked && [ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL].includes(user.role as any)) {
      await this.prisma.approvalLog.create({
        data: {
          assessmentId,
          action: ApprovalAction.EDITED,
          performedById: user.id,
          performedByRole: user.role,
          note: 'Locked mark edited',
        },
      });
    }

    await this.redis.del(`marks-sheet:${assessmentId}`, `class-results:${assessment.classId}:${assessment.termId}`);
    return updated;
  }

  async submitAssessment(id: string, _dto: SubmitAssessmentDto, user: RequestUser) {
    const assessment = await this.getAssessmentOrThrow(id);
    this.ensureTeacherScope(user, assessment.classSubject.teacherId);

    const studentIdsPayload = await this.studentClient.get<any>(
      `/students/internal/class/${assessment.classId}/student-ids`,
      undefined,
      {},
    );
    const studentIds = this.unwrap<string[]>(studentIdsPayload) || [];

    const marks = await this.prisma.mark.findMany({
      where: { assessmentId: id },
      select: { studentId: true },
    });

    const markedIds = new Set(marks.map((m) => m.studentId));
    const missing = studentIds.filter((studentId) => !markedIds.has(studentId));

    if (missing.length) {
      throw new BadRequestException(`Missing marks for ${missing.length} students`);
    }

    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        status: AssessmentStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedById: user.id,
      },
    });

    await this.prisma.approvalLog.create({
      data: {
        assessmentId: id,
        action: ApprovalAction.SUBMITTED,
        performedById: user.id,
        performedByRole: user.role,
      },
    });

    await this.rabbitMq.publish('marks.approval.requested', {
      assessmentId: id,
      classSubjectId: assessment.classSubjectId,
      teacherId: user.id,
      termId: assessment.termId,
    });

    return updated;
  }

  private buildStats(scores: number[]) {
    const sorted = [...scores].sort((a, b) => a - b);
    return {
      count: scores.length,
      mean: mean(scores),
      median: median(scores),
      highest: sorted[sorted.length - 1] ?? 0,
      lowest: sorted[0] ?? 0,
      stdDeviation: stdDeviation(scores),
    };
  }

  async pendingApproval(filters: { classId?: string; subjectId?: string }, user: RequestUser) {
    const status = user.role === ROLES.PRINCIPAL ? AssessmentStatus.HOD_APPROVED : AssessmentStatus.SUBMITTED;
    const hodSubjectIds =
      user.role === ROLES.HEAD_OF_DEPARTMENT
        ? (
            await this.prisma.classSubject.findMany({
              where: { teacherId: user.id },
              select: { subjectId: true },
            })
          ).map((item) => item.subjectId)
        : [];

    const list = await this.prisma.assessment.findMany({
      where: {
        status,
        classId: filters.classId,
        subjectId:
          user.role === ROLES.HEAD_OF_DEPARTMENT
            ? { in: filters.subjectId ? [filters.subjectId] : hodSubjectIds }
            : filters.subjectId,
      },
      include: {
        classSubject: { include: { subject: true } },
        marks: { select: { score: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    return list.map((assessment) => ({
      ...assessment,
      statistics: this.buildStats(assessment.marks.map((m) => m.score)),
    }));
  }

  async reviewAssessment(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        marks: true,
        classSubject: { include: { subject: true } },
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const alertsPayload = await this.studentClient.get<any>(
      '/api/v1/students/performance/alerts',
      { classId: assessment.classId, subjectId: assessment.subjectId, isResolved: false },
      { 'X-User-Id': 'academic-service', 'X-User-Role': ROLES.PRINCIPAL },
    );

    const alerts = this.unwrap<any>(alertsPayload);
    const activeScale = await this.prisma.gradingScale.findFirst({
      where: { academicYearId: assessment.academicYearId, isActive: true },
      include: { grades: true },
    });
    const gradeDistribution: Record<string, number> = {};
    if (activeScale) {
      for (const grade of activeScale.grades) {
        gradeDistribution[grade.grade] = 0;
      }

      for (const mark of assessment.marks) {
        const ratio = assessment.maxScore > 0 ? (mark.score / assessment.maxScore) * 100 : 0;
        const band = activeScale.grades.find((g) => ratio >= g.minScore && ratio <= g.maxScore);
        if (band) {
          gradeDistribution[band.grade] = (gradeDistribution[band.grade] || 0) + 1;
        }
      }
    }

    return {
      assessment,
      statistics: this.buildStats(assessment.marks.map((m) => m.score)),
      gradeDistributionPreview: gradeDistribution,
      performanceAlerts: alerts,
    };
  }

  async approveAssessment(id: string, dto: ApproveAssessmentDto, user: RequestUser) {
    const assessment = await this.getAssessmentOrThrow(id);

    if (user.role === ROLES.HEAD_OF_DEPARTMENT) {
      await this.assertHodSubjectScope(user, assessment.subjectId);
      if (assessment.status !== AssessmentStatus.SUBMITTED) {
        throw new BadRequestException('Assessment is not awaiting HOD approval');
      }

      const updated = await this.prisma.assessment.update({
        where: { id },
        data: {
          status: AssessmentStatus.HOD_APPROVED,
          approvedAt: new Date(),
          approvedById: user.id,
        },
      });

      await this.prisma.approvalLog.create({
        data: {
          assessmentId: id,
          action: ApprovalAction.APPROVED,
          performedById: user.id,
          performedByRole: user.role,
          note: dto.note,
        },
      });

      await this.rabbitMq.publish('marks.approved', { assessmentId: id, approvedById: user.id, role: user.role });
      return updated;
    }

    if (user.role !== ROLES.PRINCIPAL && user.role !== ROLES.ACADEMIC_QA) {
      throw new ForbiddenException('Only HOD or Principal can approve');
    }

    if (!([AssessmentStatus.SUBMITTED, AssessmentStatus.HOD_APPROVED] as AssessmentStatus[]).includes(assessment.status)) {
      throw new BadRequestException('Assessment is not awaiting principal approval');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.mark.updateMany({ where: { assessmentId: id }, data: { isLocked: true } });
      await tx.approvalLog.create({
        data: {
          assessmentId: id,
          action: ApprovalAction.LOCKED,
          performedById: user.id,
          performedByRole: user.role,
          note: dto.note,
        },
      });

      return tx.assessment.update({
        where: { id },
        data: {
          status: AssessmentStatus.LOCKED,
          lockedAt: new Date(),
          approvedAt: new Date(),
          approvedById: user.id,
        },
      });
    });

    await this.rabbitMq.publish('marks.approved', { assessmentId: id, approvedById: user.id, role: user.role });

    const openCount = await this.prisma.assessment.count({
      where: {
        classSubjectId: assessment.classSubjectId,
        termId: assessment.termId,
        status: { not: AssessmentStatus.LOCKED },
      },
    });

    let computed: unknown = null;
    if (openCount === 0 && this.resultsService) {
      computed = await this.resultsService.computeTermResults(assessment.classSubjectId, assessment.termId);
    }

    const highAlertsPayload = await this.studentClient.get<any>(
      '/api/v1/students/performance/alerts',
      { classId: assessment.classId, isResolved: false, severity: 'HIGH,CRITICAL' },
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );
    const alertsResponse = this.unwrap<any>(highAlertsPayload);
    const alerts = Array.isArray(alertsResponse?.items)
      ? alertsResponse.items
      : Array.isArray(alertsResponse)
        ? alertsResponse
        : [];

    const criticalStudents = alerts
      .filter((item: any) => item.severity === 'CRITICAL')
      .map((item: any) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        alertType: item.alertType,
        subjectName: item.subjectName,
        score: item.score,
      }));

    const atRiskStudents = alerts
      .filter((item: any) => item.severity === 'HIGH')
      .map((item: any) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        subjectName: item.subjectName,
        score: item.score,
      }));

    return {
      assessment: updated,
      computed,
      performanceIntelligence: {
        newAlertsTriggered: alerts.length,
        criticalStudents,
        atRiskStudents,
        improvingStudents: [],
        pairingSuggestionsCreated: 0,
        recommendedActions:
          criticalStudents.length > 0
            ? [`${criticalStudents.length} students require immediate academic support.`]
            : ['No critical alerts. Continue normal monitoring.'],
      },
    };
  }

  async rejectAssessment(id: string, dto: RejectAssessmentDto, user: RequestUser) {
    if (![ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA].includes(user.role as any)) {
      throw new ForbiddenException('Only HOD/Principal/Academic QA can reject');
    }

    const assessment = await this.getAssessmentOrThrow(id);
    await this.assertHodSubjectScope(user, assessment.subjectId);

    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        status: AssessmentStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedById: user.id,
        rejectionReason: dto.reason,
      },
    });

    await this.prisma.approvalLog.create({
      data: {
        assessmentId: id,
        action: ApprovalAction.REJECTED,
        performedById: user.id,
        performedByRole: user.role,
        note: dto.reason,
      },
    });

    await this.rabbitMq.publish('marks.rejected', {
      assessmentId: id,
      rejectedById: user.id,
      reason: dto.reason,
      teacherId: assessment.classSubject.teacherId,
    });

    return updated;
  }
}
