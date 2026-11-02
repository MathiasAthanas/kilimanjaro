import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { schoolScopeFilter, assertSchoolInScope } from '../common/helpers/school-scope.helper';
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

  async generateForClassTerm(classId: string, termId: string, actorId: string) {
    const labels = await this.termLabels(termId, actorId);
    const termResults = await this.prisma.termResult.findMany({
      where: { classId, termId },
      orderBy: [{ studentId: 'asc' }, { weightedTotal: 'desc' }],
    });

    const byStudent = new Map<string, typeof termResults>();
    for (const row of termResults) {
      if (!byStudent.has(row.studentId)) {
        byStudent.set(row.studentId, []);
      }
      byStudent.get(row.studentId)!.push(row);
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
      const card = await this.summarizeRows(rows as any, principalSubjectIds, schoolId);
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

      const pdfUrl = await this.pdfService.generatePdf({
        studentId,
        termId,
        academicYearId: firstRow.academicYearId,
        ...labels,
        studentName: `${studentProfile?.firstName || ''} ${studentProfile?.lastName || ''}`.trim() || studentId,
        registrationNumber: studentProfile?.registrationNumber || '-',
        className,
        generatedAt: new Date(),
        results: rows.map((row) => {
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
        subjectsExpected: card.subjectsExpected,
        overallGrade: resolved.grade,
        reportTemplateCode,
        divisionSummary,
        rank: ranking.get(studentId),
        totalStudents: byStudent.size,
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

  /**
   * All report cards for a class + term, enriched with student identity so
   * the dashboard report-card centre can list and download per student.
   */
  async listForClass(classId: string, termId: string, actorId: string) {
    const cards = await this.prisma.reportCard.findMany({
      where: { classId, termId },
      orderBy: [{ rank: 'asc' }, { overallAverage: 'desc' }],
    });

    const studentsPayload = await this.studentClient.get<any>(
      `/students/classes/${classId}/students`,
      { limit: 500 },
      this.internalHeaders(actorId),
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

  async getReportPdfPath(studentId: string, termId: string, user: RequestUser) {
    const reportCard = await this.getReportCard(studentId, termId, user);
    if (!reportCard.pdfUrl) {
      throw new NotFoundException('Report PDF not generated');
    }

    return reportCard.pdfUrl;
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

  private async regenerateSingleStudentPdf(
    studentId: string,
    termId: string,
    actorId: string,
    currentCard: any,
  ): Promise<void> {
    const rows = await this.prisma.termResult.findMany({
      where: { studentId, termId },
      orderBy: { weightedTotal: 'desc' },
    });
    if (!rows.length) return;

    const firstRow = rows[0];

    // Resolve A-Level principal subjects for this student (if applicable).
    let principalSubjectIds: Set<string> | undefined;
    if (firstRow.combinationId) {
      const comboSubjects = await this.prisma.subjectCombinationSubject.findMany({
        where: { combinationId: firstRow.combinationId, subjectRole: 'PRINCIPAL' },
        select: { subjectId: true },
      });
      principalSubjectIds = new Set(comboSubjects.map((cs) => cs.subjectId));
    }

    const card = await this.summarizeRows(rows as any, principalSubjectIds, (firstRow as any).schoolId ?? null);
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
    const pdfUrl = await this.pdfService.generatePdf({
      studentId,
      termId,
      academicYearId: firstRow.academicYearId,
      ...labels,
      studentName: `${studentProfile?.firstName || ''} ${studentProfile?.lastName || ''}`.trim() || studentId,
      registrationNumber: studentProfile?.registrationNumber || '-',
      className,
      generatedAt: new Date(),
      results: rows.map((row) => {
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
      subjectsExpected: card.subjectsExpected,
      overallGrade: resolved.grade,
      reportTemplateCode,
      divisionSummary,
      rank: currentCard.rank,
      totalStudents: currentCard.totalStudentsInClass,
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
