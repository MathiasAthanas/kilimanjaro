import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { schoolScopeFilter, assertSchoolInScope, requireWriteSchoolId, resolveWriteSchoolId } from '../common/helpers/school-scope.helper';
import { formatClassLabel } from '../common/helpers/class-label.helper';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AccessControlService } from '../common/helpers/access-control.service';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { UpdateCommentsDto } from './dto/update-comments.dto';
import { ReportCardPdfService } from './report-card-pdf.service';
import { GradingResolverService } from '../exams/grading-resolver.service';
import { competitionRanks, computeDivision, round, scaleDirection } from '../exams/engine/result-engine';
import { ReportCardPolicyService, ReportCardPolicyValues } from './report-card-policy.service';

export type BulkReportCardFile = {
  pdfUrl: string;
  studentId: string;
  classId: string;
  className: string;
  registrationNumber: string | null;
  rank: number | null;
};

type ReportCardGenerationContext = {
  examLabel?: string;
};

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly studentClient: StudentClientService,
    private readonly rabbitMq: RabbitMqService,
    private readonly pdfService: ReportCardPdfService,
    private readonly accessControl: AccessControlService,
    private readonly grading: GradingResolverService,
    private readonly policyService: ReportCardPolicyService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  /**
   * Overall grade for an average, via the SAME resolver the merit list uses.
   * Throws a clear error when no grading scale is active (never a silent fallback).
   */
  private async gradeFromAverage(
    avg: number,
    academicYearId: string,
    scope: { educationStage?: string | null; classLevel?: number | null },
    schoolId?: string | null,
  ): Promise<{ grade: string; points: number; remark: string }> {
    const scale = await this.grading.getActiveScale(academicYearId, { ...scope, subjectId: null }, schoolId ?? null);
    const r = this.grading.resolveGrade(scale, avg);
    return { grade: r.grade, points: r.points, remark: r.remark };
  }

  /** Per-student figures shared by bulk generation and single-PDF regeneration. EXEMPT rows never count. */
  private async summarizeRows(
    rows: Array<{ subjectId: string; weightedTotal: number; gradePoints: number; grade: string; isPassing: boolean; resultStatus?: string | null; educationStage: any; classLevel: number | null; academicYearId: string }>,
    principalSubjectIds: Set<string> | undefined,
    schoolId: string | null,
    policy: ReportCardPolicyValues,
  ) {
    const counted = rows.filter((r) => (r.resultStatus ?? 'SCORED') !== 'EXEMPT');
    const avg = counted.length ? round(counted.reduce((s, r) => s + r.weightedTotal, 0) / counted.length) : 0;
    const first = rows[0];
    const resolved = counted.length
      ? await this.gradeFromAverage(avg, first.academicYearId, { educationStage: first.educationStage, classLevel: first.classLevel }, schoolId)
      : { grade: '-', points: 0, remark: 'No assessed subjects' };
    let direction: 'LOWER_BETTER' | 'HIGHER_BETTER' = 'HIGHER_BETTER';
    if (first.educationStage === 'A_LEVEL') {
      const scale = await this.grading
        .getActiveScale(first.academicYearId, { educationStage: first.educationStage, classLevel: first.classLevel, subjectId: null }, schoolId)
        .catch(() => null);
      direction = scaleDirection(scale) ?? 'HIGHER_BETTER';
    }
    const division = computeDivision(
      first.educationStage,
      counted.map((r) => ({ subjectId: r.subjectId, grade: r.grade, gradePoints: r.gradePoints, isPassing: r.isPassing })),
      principalSubjectIds,
      direction,
      { overallAverage: avg, primaryPassMark: policy.primaryPassMark },
    );
    const divisionSummary = {
      ...division,
      subjectsAssessed: counted.length,
      subjectsExpected: rows.length,
      exemptSubjects: rows.length - counted.length,
    };
    return {
      avg,
      resolved,
      divisionSummary,
      subjectsAssessed: counted.length,
      subjectsExpected: rows.length,
      exemptSubjectCount: rows.length - counted.length,
      failingSubjectCount: counted.filter((r) => !r.isPassing).length,
    };
  }

  private applyAlternativeSubjectPolicy<T extends {
    subjectId: string;
    subjectName: string;
    resultStatus?: string | null;
    weightedTotal: number;
    grade: string;
    gradePoints: number;
    remark: string;
    isPassing: boolean;
  }>(rows: T[], policy: ReportCardPolicyValues): T[] {
    if (!policy.autoAlternativeSubjectExemptions) return rows;
    const decision = this.policyService.alternativeDecision(rows);
    const exemptIds = new Set(decision.exemptSubjectIds);
    return rows.map((row) => exemptIds.has(row.subjectId)
      ? {
          ...row,
          resultStatus: 'EXEMPT',
          weightedTotal: 0,
          grade: 'EXEMPT',
          gradePoints: 0,
          remark: 'Exempt',
          isPassing: true,
        }
      : row);
  }

  private reportTemplateFor(stage: string | null, classLevel: number | null): string {
    if (stage === 'PRIMARY') return 'PRIMARY_STANDARD';
    if (stage === 'A_LEVEL' && classLevel === 6) return 'A_LEVEL_NATIONAL_READY';
    if (stage === 'A_LEVEL') return 'A_LEVEL_COMBINATION';
    if (stage === 'O_LEVEL' && classLevel === 4) return 'O_LEVEL_NATIONAL_READY';
    return 'O_LEVEL_TERM';
  }

  /** Group-scope headers for internal student-service reads made on behalf of an actor. */
  private internalHeaders(actorId: string): Record<string, string> {
    return { 'X-User-Id': actorId, 'X-User-Role': ROLES.PRINCIPAL, 'X-User-Scope': 'GROUP', 'X-User-School-Ids': '*' };
  }

  /** Term + academic-year names for the PDF header (best effort; ids are the fallback). */
  private async termLabels(termId: string, actorId: string): Promise<{ termName?: string; academicYearName?: string }> {
    try {
      const payload = await this.studentClient.get<any>('/students/terms', {}, this.internalHeaders(actorId));
      const list = this.unwrap<any>(payload);
      const term = (Array.isArray(list) ? list : list?.items ?? []).find((t: any) => t.id === termId);
      return { termName: term?.name, academicYearName: term?.academicYear?.name };
    } catch {
      return {};
    }
  }

  private compositionLabel(composition: { name?: string | null; windowSelections?: unknown } | null): string | undefined {
    const explicit = composition?.name?.trim();
    if (explicit) return explicit;
    const selections = Array.isArray(composition?.windowSelections) ? composition!.windowSelections : [];
    const names = selections
      .map((item: any) => String(item?.name ?? '').trim())
      .filter(Boolean);
    return names.length ? [...new Set(names)].join(' + ') : undefined;
  }

  private async resolveExamLabel(classId: string, termId: string, schoolId: string | null): Promise<string | undefined> {
    const existing = await this.prisma.reportCard.findFirst({
      where: { classId, termId },
      select: { examLabel: true },
    });
    if (existing?.examLabel?.trim()) return existing.examLabel.trim();

    const compositions = await this.prisma.reportCardComposition.findMany({
      where: { termId, schoolId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { name: true, scopeClassIds: true, windowSelections: true },
    });
    const matching = compositions.find((item) => !item.scopeClassIds.length || item.scopeClassIds.includes(classId));
    return this.compositionLabel(matching ?? null);
  }

  async generateForClassTerm(
    classId: string,
    termId: string,
    actorId: string,
    context: ReportCardGenerationContext = {},
  ) {
    const labels = await this.termLabels(termId, actorId);
    const termResults = await this.prisma.termResult.findMany({
      where: { classId, termId },
      orderBy: [{ studentId: 'asc' }, { weightedTotal: 'desc' }],
    });
    const policy = await this.policyService.getForSchool(termResults[0]?.schoolId ?? null);
    const examLabel = context.examLabel?.trim()
      || await this.resolveExamLabel(classId, termId, termResults[0]?.schoolId ?? null);

    const byStudent = new Map<string, typeof termResults>();
    for (const row of termResults) {
      if (!byStudent.has(row.studentId)) {
        byStudent.set(row.studentId, []);
      }
      byStudent.get(row.studentId)!.push(row);
    }
    for (const [studentId, rows] of byStudent.entries()) {
      byStudent.set(studentId, this.applyAlternativeSubjectPolicy(rows, policy));
    }

    // Pre-fetch PRINCIPAL subject IDs per A-Level combination so the ACSEE
    // division algorithm can filter correctly.
    const uniqueCombinationIds = new Set<string>();
    for (const rows of byStudent.values()) {
      for (const row of rows) {
        if (row.combinationId) uniqueCombinationIds.add(row.combinationId);
      }
    }

    const principalsByCombo = new Map<string, Set<string>>();
    if (uniqueCombinationIds.size > 0) {
      const comboSubjects = await this.prisma.subjectCombinationSubject.findMany({
        where: { combinationId: { in: [...uniqueCombinationIds] }, subjectRole: 'PRINCIPAL' },
        select: { combinationId: true, subjectId: true },
      });
      for (const item of comboSubjects) {
        if (!principalsByCombo.has(item.combinationId)) {
          principalsByCombo.set(item.combinationId, new Set());
        }
        principalsByCombo.get(item.combinationId)!.add(item.subjectId);
      }
    }

    const averages = [...byStudent.entries()].map(([studentId, rows]) => {
      const counted = rows.filter((r) => (r.resultStatus ?? 'SCORED') !== 'EXEMPT');
      return {
        studentId,
        average: counted.length ? round(counted.reduce((sum, item) => sum + item.weightedTotal, 0) / counted.length) : 0,
      };
    });
    // Competition ranking on the normalized average: ties share a position.
    const ranking = new Map(Object.entries(competitionRanks(averages, (a) => a.studentId, (a) => a.average)));

    // A student's stream position is calculated above. The overall position uses
    // every stream at the same school, stage and class level for this term.
    const firstResult = termResults[0];
    const levelRows = firstResult
      ? await this.prisma.termResult.findMany({
          where: {
            schoolId: firstResult.schoolId,
            termId,
            academicYearId: firstResult.academicYearId,
            educationStage: firstResult.educationStage,
            classLevel: firstResult.classLevel,
          },
          select: {
            studentId: true,
            subjectId: true,
            subjectName: true,
            resultStatus: true,
            weightedTotal: true,
            grade: true,
            gradePoints: true,
            remark: true,
            isPassing: true,
          },
        })
      : [];
    const levelByStudent = new Map<string, typeof levelRows>();
    for (const row of levelRows) {
      const current = levelByStudent.get(row.studentId) ?? [];
      current.push(row);
      levelByStudent.set(row.studentId, current);
    }
    const levelAverages = [...levelByStudent.entries()].map(([studentId, rawRows]) => {
      const applicable = this.applyAlternativeSubjectPolicy(rawRows, policy)
        .filter((row) => (row.resultStatus ?? 'SCORED') !== 'EXEMPT');
      return {
        studentId,
        average: applicable.length
          ? round(applicable.reduce((sum, row) => sum + row.weightedTotal, 0) / applicable.length)
          : 0,
      };
    });
    const overallRanking = new Map(Object.entries(
      competitionRanks(levelAverages, (item) => item.studentId, (item) => item.average),
    ));

    const alertsPayload = await this.studentClient.get<any>(
        '/students/performance/alerts',
      { classId, isResolved: false, severity: 'HIGH,CRITICAL' },
      this.internalHeaders(actorId),
    );

    const alertsData = this.unwrap<any>(alertsPayload);
    const alertItems = Array.isArray(alertsData?.items) ? alertsData.items : Array.isArray(alertsData) ? alertsData : [];
    const alertsByStudent = new Map<string, number>();
    for (const item of alertItems) {
      alertsByStudent.set(item.studentId, (alertsByStudent.get(item.studentId) ?? 0) + 1);
    }

    const saved: string[] = [];

    for (const [studentId, rows] of byStudent.entries()) {
      const firstRow = rows[0];
      const schoolId = (firstRow as any).schoolId ?? null;
      const reportTemplateCode = this.reportTemplateFor(firstRow.educationStage, firstRow.classLevel);
      const principalSubjectIds = firstRow.combinationId ? principalsByCombo.get(firstRow.combinationId) : undefined;
      const card = await this.summarizeRows(rows as any, principalSubjectIds, schoolId, policy);
      const { avg, resolved, divisionSummary } = card;
      const subjectCount = card.subjectsAssessed;
      const failingSubjectCount = card.failingSubjectCount;

      const current = await this.prisma.reportCard.upsert({
        where: { studentId_termId: { studentId, termId } },
        create: {
          studentId,
          classId,
          schoolId,
          educationStage: firstRow.educationStage,
          classLevel: firstRow.classLevel,
          combinationId: firstRow.combinationId,
          termId,
          academicYearId: firstRow.academicYearId,
          overallAverage: avg,
          overallGrade: resolved.grade,
          overallPoints: resolved.points,
          overallRemark: resolved.remark,
          reportTemplateCode,
          divisionSummary,
          rank: ranking.get(studentId),
          totalStudentsInClass: byStudent.size,
          overallRank: overallRanking.get(studentId),
          totalStudentsInLevel: levelByStudent.size,
          examLabel,
          subjectCount,
          subjectsExpected: card.subjectsExpected,
          exemptSubjectCount: card.exemptSubjectCount,
          failingSubjectCount,
        },
        update: {
          schoolId,
          educationStage: firstRow.educationStage,
          classLevel: firstRow.classLevel,
          combinationId: firstRow.combinationId,
          overallAverage: avg,
          overallGrade: resolved.grade,
          overallPoints: resolved.points,
          overallRemark: resolved.remark,
          reportTemplateCode,
          divisionSummary,
          rank: ranking.get(studentId),
          totalStudentsInClass: byStudent.size,
          overallRank: overallRanking.get(studentId),
          totalStudentsInLevel: levelByStudent.size,
          examLabel,
          subjectCount,
          subjectsExpected: card.subjectsExpected,
          exemptSubjectCount: card.exemptSubjectCount,
          failingSubjectCount,
        },
      });

      // Fetch student profile, attendance, and performance in parallel instead of sequentially.
      const [studentProfilePayload, attendancePayload, performancePayload] = await Promise.all([
        this.studentClient.get<any>(`/students/${studentId}`, undefined, {
          ...this.internalHeaders(actorId),
        }),
        this.studentClient.get<any>(`/students/attendance/summary/${studentId}`, {}, {
          ...this.internalHeaders(actorId),
        }),
        this.studentClient.get<any>(`/students/performance/${studentId}`, {}, {
          ...this.internalHeaders(actorId),
        }),
      ]);

      const studentProfile = this.unwrap<any>(studentProfilePayload);
      const className = studentProfile?.enrolments?.[0]?.class?.name || classId;
      const attendanceSummary = (this.unwrap<any[]>(attendancePayload) || []).find((item) => item.termId === termId);

      const performance = this.unwrap<any>(performancePayload);
      const hasActivePairing = Array.isArray(performance?.pairings)
        ? performance.pairings.some((item: any) => ['ACTIVE', 'SUGGESTED'].includes(item.status))
        : false;

      const visibleRows = policy.hideExemptSubjects
        ? rows.filter((row) => row.resultStatus !== 'EXEMPT')
        : rows;
      const pdfUrl = await this.pdfService.generatePdf({
        studentId,
        termId,
        academicYearId: firstRow.academicYearId,
        ...labels,
        studentName: `${studentProfile?.firstName || ''} ${studentProfile?.lastName || ''}`.trim() || studentId,
        registrationNumber: studentProfile?.registrationNumber || '-',
        className,
        generatedAt: new Date(),
        results: visibleRows.map((row) => {
          const role = principalSubjectIds
            ? (principalSubjectIds.has(row.subjectId) ? 'PRINCIPAL' : 'SUBSIDIARY')
            : undefined;
          return {
            subjectName: row.subjectName,
            subjectRole: role,
            ...(row.assessmentScores as any),
            total: row.weightedTotal,
            grade: row.grade,
            gradePoints: row.gradePoints,
            remark: row.remark,
            status: row.resultStatus,
          };
        }),
        average: avg,
        subjectsAssessed: card.subjectsAssessed,
        subjectsExpected: policy.hideExemptSubjects ? card.subjectsAssessed : card.subjectsExpected,
        failingSubjectCount: card.failingSubjectCount,
        showSubjectSupport: policy.showSubjectSupport,
        overallGrade: resolved.grade,
        reportTemplateCode,
        divisionSummary,
        rank: ranking.get(studentId),
        totalStudents: byStudent.size,
        overallRank: overallRanking.get(studentId),
        totalStudentsOverall: levelByStudent.size,
        examLabel,
        teacherComment: current.teacherComment,
        principalComment: current.principalComment,
        internalPerformanceNote: `${alertsByStudent.get(studentId) ?? 0} active high/critical alerts`,
        attendance: attendanceSummary
          ? {
              total: attendanceSummary.total,
              present: attendanceSummary.present,
              absent: attendanceSummary.absent,
              late: attendanceSummary.late,
              attendanceRate: attendanceSummary.attendanceRate,
              belowThreshold: attendanceSummary.belowThreshold,
            }
          : undefined,
        pairingStatus: hasActivePairing ? 'Active/Suggested pairing present' : 'No active pairing',
        // Primary holistic fields — carried from any previously saved values
        behaviourGrade:      current.behaviourGrade,
        socialSkillsGrade:   current.socialSkillsGrade,
        extraCurricularNote: current.extraCurricularNote,
        readingAbility:      current.readingAbility,
        writingAbility:      current.writingAbility,
        numeracyAbility:     current.numeracyAbility,
      });

      await this.prisma.reportCard.update({
        where: { id: current.id },
        data: { pdfUrl, pdfGeneratedAt: new Date() },
      });

      await this.rabbitMq.publish('report_card.generated', { studentId, termId, pdfUrl });
      await this.redis.del(`report-card:${studentId}:${termId}`);
      saved.push(studentId);
    }

    return { generated: saved.length, classId, termId };
  }

  async generate(dto: GenerateReportCardsDto, user: RequestUser) {
    return this.generateForClassTerm(dto.classId, dto.termId, user.id);
  }

  async getReportCard(studentId: string, termId: string, user: RequestUser) {
    const cacheKey = `report-card:${studentId}:${termId}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    if (user.role === ROLES.PARENT) {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user.role === ROLES.STUDENT) {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }

    const reportCard = await this.prisma.reportCard.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found');
    }

    if ([ROLES.PARENT, ROLES.STUDENT].includes(user.role as any)) {
      if (!reportCard.isPublished) {
        throw new ForbiddenException('Report card not published');
      }
    } else {
      // Staff: block cross-school access by id (group users pass through).
      assertSchoolInScope(user, (reportCard as { schoolId?: string | null }).schoolId ?? null);
    }

    await this.redis.set(cacheKey, reportCard, 1800);
    return reportCard;
  }

  async listForStudent(studentId: string, user: RequestUser) {
    if (user.role === ROLES.PARENT) {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user.role === ROLES.STUDENT) {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }

    return this.prisma.reportCard.findMany({
      where: {
        studentId,
        ...(([ROLES.PARENT, ROLES.STUDENT] as string[]).includes(user.role) ? { isPublished: true } : {}),
      },
      orderBy: [{ academicYearId: 'desc' }, { termId: 'asc' }],
    });
  }

  /** Classes and terms that already have generated report cards in the caller's school scope. */
  async listAvailableClasses(user: RequestUser) {
    const cards = await this.prisma.reportCard.findMany({
      where: schoolScopeFilter(user),
      select: {
        classId: true,
        termId: true,
        academicYearId: true,
        schoolId: true,
        educationStage: true,
        classLevel: true,
        examLabel: true,
        isPublished: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!cards.length) return [];

    const classesPayload = await this.studentClient.get<any>(
      '/students/classes',
      {},
      this.internalHeaders(user.id),
    );
    const classesData = this.unwrap<any>(classesPayload);
    const classes = Array.isArray(classesData)
      ? classesData
      : Array.isArray(classesData?.items)
        ? classesData.items
        : Array.isArray(classesData?.classes)
          ? classesData.classes
          : [];
    const classById = new Map<string, any>(classes.map((item: any) => [String(item.id), item]));

    const groups = new Map<string, {
      classId: string;
      className: string;
      stream: string | null;
      termId: string;
      academicYearId: string;
      schoolId: string | null;
      educationStage: string;
      classLevel: number | null;
      examLabel: string | null;
      termName: string | null;
      reportCards: number;
      publishedCards: number;
      updatedAt: Date;
    }>();
    const termIds = [...new Set(cards.map((card) => card.termId))];
    const termEntries = await Promise.all(termIds.map(async (termId) => [termId, await this.termLabels(termId, user.id)] as const));
    const labelsByTerm = new Map(termEntries);
    for (const card of cards) {
      const key = `${card.classId}:${card.termId}`;
      const current = groups.get(key);
      if (current) {
        current.reportCards += 1;
        if (card.isPublished) current.publishedCards += 1;
        if (card.updatedAt > current.updatedAt) current.updatedAt = card.updatedAt;
        continue;
      }
      const classRecord = classById.get(card.classId);
      groups.set(key, {
        classId: card.classId,
        className: classRecord?.name ?? card.classId,
        stream: classRecord?.stream ?? null,
        termId: card.termId,
        academicYearId: card.academicYearId,
        schoolId: card.schoolId ?? null,
        educationStage: card.educationStage,
        classLevel: card.classLevel,
        examLabel: card.examLabel ?? null,
        termName: labelsByTerm.get(card.termId)?.termName ?? null,
        reportCards: 1,
        publishedCards: card.isPublished ? 1 : 0,
        updatedAt: card.updatedAt,
      });
    }

    return [...groups.values()].sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime() || a.className.localeCompare(b.className),
    );
  }

  /**
   * All report cards for a class + term, enriched with student identity so
   * the dashboard report-card centre can list and download per student.
   */
  async listForClass(classId: string, termId: string, user: RequestUser) {
    const cards = await this.prisma.reportCard.findMany({
      where: { classId, termId, ...schoolScopeFilter(user) },
      orderBy: [{ rank: 'asc' }, { overallAverage: 'desc' }],
    });

    const studentsPayload = await this.studentClient.get<any>(
      `/students/classes/${classId}/students`,
      { limit: 500 },
      this.internalHeaders(user.id),
    );
    const studentsData = this.unwrap<any>(studentsPayload);
    // Endpoint returns enrolment rows with the student nested inside
    const enrolmentItems: any[] = Array.isArray(studentsData?.students)
      ? studentsData.students
      : Array.isArray(studentsData?.items)
      ? studentsData.items
      : Array.isArray(studentsData)
        ? studentsData
        : [];
    const studentById = new Map<string, any>(
      enrolmentItems
        .map((item) => item.student ?? item)
        .filter((student) => student?.id)
        .map((student) => [String(student.id), student]),
    );

    return cards.map((card) => {
      const student = studentById.get(card.studentId);
      return {
        ...card,
        studentName: student
          ? `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim()
          : card.studentId,
        registrationNumber: student?.registrationNumber ?? null,
      };
    });
  }

  async bulkFiles(
    scope: { classId: string } | { educationStage: string; classLevel: number },
    termId: string,
    examLabel: string | undefined,
    user: RequestUser,
  ): Promise<{ files: BulkReportCardFile[]; baseName: string }> {
    const selectionWhere = {
      termId,
      isPublished: true,
      pdfUrl: { not: null },
      ...(examLabel?.trim() ? { examLabel: { equals: examLabel.trim(), mode: 'insensitive' as const } } : {}),
      ...('classId' in scope
        ? { classId: scope.classId }
        : { educationStage: scope.educationStage as any, classLevel: scope.classLevel }),
    };
    let schoolId = resolveWriteSchoolId(user);
    if (!schoolId) {
      const owners = await this.prisma.reportCard.findMany({
        where: { ...selectionWhere, ...schoolScopeFilter(user) },
        distinct: ['schoolId'],
        select: { schoolId: true },
        take: 2,
      });
      const schoolIds = [...new Set(owners.map((owner) => owner.schoolId).filter((id): id is string => Boolean(id)))];
      if (!schoolIds.length) {
        throw new NotFoundException('No published report cards match the selected school, term, exam and class scope.');
      }
      if (schoolIds.length > 1) {
        throw new BadRequestException('Select a school before downloading report cards across multiple schools.');
      }
      schoolId = schoolIds[0];
      assertSchoolInScope(user, schoolId);
    }
    const cards = await this.prisma.reportCard.findMany({
      where: {
        schoolId,
        ...selectionWhere,
      },
      orderBy: [{ classId: 'asc' }, { rank: 'asc' }, { overallAverage: 'desc' }],
      select: { pdfUrl: true, studentId: true, classId: true, rank: true },
    });
    if (!cards.length) {
      throw new NotFoundException('No published report cards match the selected school, term, exam and class scope.');
    }

    const [classesPayload, ...rosters] = await Promise.all([
      this.studentClient.get<any>('/students/classes', {}, this.internalHeaders(user.id)),
      ...[...new Set(cards.map((card) => card.classId))].map((classId) =>
        this.studentClient.get<any>(`/students/classes/${classId}/students`, { limit: 1000 }, this.internalHeaders(user.id)),
      ),
    ]);
    const classesData = this.unwrap<any>(classesPayload);
    const classes = Array.isArray(classesData) ? classesData : classesData?.items ?? classesData?.classes ?? [];
    const classById = new Map<string, any>(classes.map((item: any) => [String(item.id), item]));
    const studentById = new Map<string, any>();
    for (const payload of rosters) {
      const data = this.unwrap<any>(payload);
      const items = Array.isArray(data?.students) ? data.students : Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      for (const item of items) {
        const student = item?.student ?? item;
        if (student?.id) studentById.set(String(student.id), student);
      }
    }

    const files = cards.map((card) => {
      const student = studentById.get(card.studentId);
      const klass = classById.get(card.classId);
      return {
        pdfUrl: card.pdfUrl!,
        studentId: card.studentId,
        classId: card.classId,
        className: formatClassLabel(klass?.name ?? card.classId, klass?.stream ?? null),
        registrationNumber: student?.registrationNumber ?? null,
        rank: card.rank,
      };
    }).sort((a, b) => a.className.localeCompare(b.className) || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
    const baseName = 'classId' in scope
      ? `${files[0].className}_Report_Cards`
      : `${scope.educationStage}_Level_${scope.classLevel}_All_Streams_Report_Cards`;
    return { files, baseName };
  }

  async getReportPdfPath(studentId: string, termId: string, user: RequestUser) {
    const reportCard = await this.getReportCard(studentId, termId, user);
    if (!reportCard.pdfUrl) {
      throw new NotFoundException('Report PDF not generated');
    }

    return reportCard.pdfUrl;
  }

  private async buildRecalculationPlan(termId: string, user: RequestUser) {
    const schoolId = requireWriteSchoolId(user, 'report-card recalculation');
    const policy = await this.policyService.getForSchool(schoolId);
    const [cards, rows] = await Promise.all([
      this.prisma.reportCard.findMany({
        where: { schoolId, termId },
        select: { classId: true, studentId: true, isPublished: true },
      }),
      this.prisma.termResult.findMany({
        where: { schoolId, termId },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          subjectName: true,
          resultStatus: true,
        },
      }),
    ]);
    const byStudent = new Map<string, typeof rows>();
    for (const row of rows) {
      const current = byStudent.get(row.studentId) ?? [];
      current.push(row);
      byStudent.set(row.studentId, current);
    }

    const rowsToExempt = new Set<string>();
    const conflicts: string[] = [];
    if (policy.autoAlternativeSubjectExemptions) {
      for (const [studentId, studentRows] of byStudent.entries()) {
        const decision = this.policyService.alternativeDecision(studentRows);
        const exemptSubjectIds = new Set(decision.exemptSubjectIds);
        for (const row of studentRows) {
          if (exemptSubjectIds.has(row.subjectId) && row.resultStatus !== 'EXEMPT') {
            rowsToExempt.add(row.id);
          }
        }
        if (decision.conflicts.length) conflicts.push(studentId);
      }
    }

    return {
      schoolId,
      termId,
      policy,
      cards,
      rowsToExempt: [...rowsToExempt],
      conflicts,
      classIds: [...new Set(cards.map((card) => card.classId))],
    };
  }

  async previewRecalculation(termId: string, user: RequestUser) {
    const plan = await this.buildRecalculationPlan(termId, user);
    return {
      termId,
      schoolId: plan.schoolId,
      reportCards: plan.cards.length,
      publishedCards: plan.cards.filter((card) => card.isPublished).length,
      classes: plan.classIds.length,
      alternativeRowsToExempt: plan.rowsToExempt.length,
      alternativeConflicts: plan.conflicts.length,
      publicationStateWillBePreserved: true,
    };
  }

  async recalculateExisting(termId: string, user: RequestUser) {
    const plan = await this.buildRecalculationPlan(termId, user);
    if (!plan.cards.length) {
      throw new BadRequestException('No generated report cards exist for the selected term and school.');
    }
    if (plan.conflicts.length) {
      throw new BadRequestException(
        `${plan.conflicts.length} student(s) have scored results in both alternative subjects. Resolve those records before recalculating.`,
      );
    }

    if (plan.rowsToExempt.length) {
      await this.prisma.termResult.updateMany({
        where: { id: { in: plan.rowsToExempt } },
        data: {
          resultStatus: 'EXEMPT',
          weightedTotal: 0,
          grade: 'EXEMPT',
          gradePoints: 0,
          remark: 'Exempt',
          isPassing: true,
        },
      });
    }

    let regenerated = 0;
    const failures: string[] = [];
    for (const classId of plan.classIds) {
      try {
        const result = await this.generateForClassTerm(classId, termId, user.id);
        regenerated += result.generated;
      } catch (error) {
        failures.push(`${classId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length) {
      throw new BadRequestException(`Recalculation did not complete for every class. ${failures[0]}`);
    }

    await this.redis.delByPattern(`report-card:*:${termId}`);
    await this.rabbitMq.publish('reportcard.policy.recalculated', {
      schoolId: plan.schoolId,
      termId,
      reportCards: regenerated,
      alternativeRowsExempted: plan.rowsToExempt.length,
      recalculatedById: user.id,
    });

    return {
      termId,
      schoolId: plan.schoolId,
      reportCardsRegenerated: regenerated,
      alternativeRowsExempted: plan.rowsToExempt.length,
      publishedCardsPreserved: plan.cards.filter((card) => card.isPublished).length,
    };
  }

  async signReportCard(id: string, signatureText: string, user: RequestUser) {
    const existing = await this.prisma.reportCard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Report card not found');
    assertSchoolInScope(user, (existing as { schoolId?: string | null }).schoolId ?? null);

    const updated = await this.prisma.reportCard.update({
      where: { id },
      data: {
        principalComment: signatureText || existing.principalComment || 'Approved',
        principalSignedAt: new Date(),
        principalSignedById: user.id,
      },
    });

    await this.rabbitMq.publish('report_card.signed', {
      reportCardId: id,
      studentId: updated.studentId,
      termId: updated.termId,
      signedById: user.id,
      signedAt: updated.principalSignedAt,
    });

    return updated;
  }

  async updateComments(id: string, dto: UpdateCommentsDto, user: RequestUser) {
    const existing = await this.prisma.reportCard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report card not found');
    }
    assertSchoolInScope(user, (existing as { schoolId?: string | null }).schoolId ?? null);

    // The report-card comment belongs to the class teacher. Where a class has no class teacher
    // assigned, a teacher of that class may write it instead. Nobody else can overwrite it.
    if (user.role === ROLES.TEACHER) {
      if (existing.isPublished) {
        throw new ForbiddenException('This report card is published. Ask an administrator to unpublish it before changing the remark.');
      }
      await this.assertMayCommentOnCard(existing.classId, user);
    }

    const data: any = {};
    if (user.role === ROLES.TEACHER && dto.teacherComment !== undefined) {
      data.teacherComment = dto.teacherComment;
    }
    if (user.role === ROLES.PRINCIPAL && dto.principalComment !== undefined) {
      data.principalComment = dto.principalComment;
      data.principalSignedAt = new Date();
      data.principalSignedById = user.id;
    }

    const updated = await this.prisma.reportCard.update({ where: { id }, data });

    // Regenerate only this student's PDF — not the entire class. The class-wide
    // call was O(students × 5 HTTP calls + PDF file writes) for a single comment update.
    await this.regenerateSingleStudentPdf(existing.studentId, existing.termId, user.id, updated);
    return updated;
  }

  private async assertMayCommentOnCard(classId: string, user: RequestUser): Promise<void> {
    let classTeacherId: string | null = null;
    try {
      const payload: any = await this.studentClient.get<unknown>(`/students/classes/${classId}/students`, { limit: 1 }, {
        'X-User-Id': user.id,
        'X-User-Role': user.role,
        'X-User-Scope': user.scope ?? 'GROUP',
        'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
        ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
      });
      const cls = (payload?.data ?? payload)?.class;
      classTeacherId = cls?.classTeacherId ?? null;
    } catch {
      /* fall through to the assignment check */
    }
    if (classTeacherId) {
      if (classTeacherId !== user.id) {
        throw new ForbiddenException('Only the class teacher can write the report card comment for this class');
      }
      return;
    }
    const teaches = await this.prisma.classSubject.count({ where: { classId, teacherId: user.id, isActive: true } });
    if (!teaches) throw new ForbiddenException('You do not teach this class');
  }

  private async regenerateSingleStudentPdf(
    studentId: string,
    termId: string,
    actorId: string,
    currentCard: any,
  ): Promise<void> {
    const storedRows = await this.prisma.termResult.findMany({
      where: { studentId, termId, classId: currentCard.classId },
      orderBy: { weightedTotal: 'desc' },
    });
    if (!storedRows.length) return;

    const firstRow = storedRows[0];
    const policy = await this.policyService.getForSchool((firstRow as any).schoolId ?? null);
    const rows = this.applyAlternativeSubjectPolicy(storedRows, policy);

    // Resolve A-Level principal subjects for this student (if applicable).
    let principalSubjectIds: Set<string> | undefined;
    if (firstRow.combinationId) {
      const comboSubjects = await this.prisma.subjectCombinationSubject.findMany({
        where: { combinationId: firstRow.combinationId, subjectRole: 'PRINCIPAL' },
        select: { subjectId: true },
      });
      principalSubjectIds = new Set(comboSubjects.map((cs) => cs.subjectId));
    }

    const card = await this.summarizeRows(rows as any, principalSubjectIds, (firstRow as any).schoolId ?? null, policy);
    const { avg, resolved, divisionSummary } = card;

    const [studentProfilePayload, attendancePayload, performancePayload] = await Promise.all([
      this.studentClient.get<any>(`/students/${studentId}`, undefined, {
        ...this.internalHeaders(actorId),
      }),
      this.studentClient.get<any>(`/students/attendance/summary/${studentId}`, {}, {
        ...this.internalHeaders(actorId),
      }),
      this.studentClient.get<any>(`/students/performance/${studentId}`, {}, {
        ...this.internalHeaders(actorId),
      }),
    ]);

    const studentProfile = this.unwrap<any>(studentProfilePayload);
    const attendanceSummary = (this.unwrap<any[]>(attendancePayload) || []).find((a) => a.termId === termId);
    const performance = this.unwrap<any>(performancePayload);
    const hasActivePairing = Array.isArray(performance?.pairings)
      ? performance.pairings.some((p: any) => ['ACTIVE', 'SUGGESTED'].includes(p.status))
      : false;

    const reportTemplateCode = this.reportTemplateFor(firstRow.educationStage, firstRow.classLevel);
    const className = studentProfile?.enrolments?.[0]?.class?.name || firstRow.classId;

    const labels = await this.termLabels(termId, actorId);
    const visibleRows = policy.hideExemptSubjects
      ? rows.filter((row) => row.resultStatus !== 'EXEMPT')
      : rows;
    const pdfUrl = await this.pdfService.generatePdf({
      studentId,
      termId,
      academicYearId: firstRow.academicYearId,
      ...labels,
      studentName: `${studentProfile?.firstName || ''} ${studentProfile?.lastName || ''}`.trim() || studentId,
      registrationNumber: studentProfile?.registrationNumber || '-',
      className,
      generatedAt: new Date(),
      results: visibleRows.map((row) => {
        const role = principalSubjectIds
          ? (principalSubjectIds.has(row.subjectId) ? 'PRINCIPAL' : 'SUBSIDIARY')
          : undefined;
        return {
          subjectName: row.subjectName,
          subjectRole: role,
          ...(row.assessmentScores as any),
          total: row.weightedTotal,
          grade: row.grade,
          gradePoints: row.gradePoints,
          remark: row.remark,
          status: row.resultStatus,
        };
      }),
      average: avg,
      subjectsAssessed: card.subjectsAssessed,
      subjectsExpected: policy.hideExemptSubjects ? card.subjectsAssessed : card.subjectsExpected,
      failingSubjectCount: card.failingSubjectCount,
      showSubjectSupport: policy.showSubjectSupport,
      overallGrade: resolved.grade,
      reportTemplateCode,
      divisionSummary,
      rank: currentCard.rank,
      totalStudents: currentCard.totalStudentsInClass,
      overallRank: currentCard.overallRank,
      totalStudentsOverall: currentCard.totalStudentsInLevel,
      examLabel: currentCard.examLabel,
      teacherComment: currentCard.teacherComment,
      principalComment: currentCard.principalComment,
      internalPerformanceNote: undefined,
      attendance: attendanceSummary
        ? {
            total: attendanceSummary.total,
            present: attendanceSummary.present,
            absent: attendanceSummary.absent,
            late: attendanceSummary.late,
            attendanceRate: attendanceSummary.attendanceRate,
            belowThreshold: attendanceSummary.belowThreshold,
          }
        : undefined,
      pairingStatus: hasActivePairing ? 'Active/Suggested pairing present' : 'No active pairing',
      behaviourGrade: currentCard.behaviourGrade,
      socialSkillsGrade: currentCard.socialSkillsGrade,
      extraCurricularNote: currentCard.extraCurricularNote,
      readingAbility: currentCard.readingAbility,
      writingAbility: currentCard.writingAbility,
      numeracyAbility: currentCard.numeracyAbility,
    });

    await this.prisma.reportCard.update({
      where: { id: currentCard.id },
      data: { pdfUrl, pdfGeneratedAt: new Date() },
    });
    await this.redis.del(`report-card:${studentId}:${termId}`);
  }
}
