import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AccessControlService } from '../common/helpers/access-control.service';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { UpdateCommentsDto } from './dto/update-comments.dto';
import { ReportCardPdfService } from './report-card-pdf.service';

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly studentClient: StudentClientService,
    private readonly rabbitMq: RabbitMqService,
    private readonly pdfService: ReportCardPdfService,
    private readonly accessControl: AccessControlService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  private fallbackGradeFromAverage(avg: number): { grade: string; points: number; remark: string } {
    if (avg >= 80) return { grade: 'A', points: 4, remark: 'Excellent' };
    if (avg >= 70) return { grade: 'B+', points: 3.5, remark: 'Very Good' };
    if (avg >= 60) return { grade: 'B', points: 3, remark: 'Good' };
    if (avg >= 50) return { grade: 'C', points: 2, remark: 'Pass' };
    if (avg >= 40) return { grade: 'D', points: 1, remark: 'Low Pass' };
    return { grade: 'F', points: 0, remark: 'Fail' };
  }

  private async gradeFromAverage(
    avg: number,
    academicYearId: string,
    scope: { educationStage?: string | null; classLevel?: number | null },
  ): Promise<{ grade: string; points: number; remark: string }> {
    const scales = await this.prisma.gradingScale.findMany({
      where: {
        academicYearId,
        isActive: true,
        OR: [
          { educationStage: scope.educationStage as any, classLevel: scope.classLevel ?? null, subjectId: null },
          { educationStage: scope.educationStage as any, classLevel: null, subjectId: null },
          { educationStage: null, classLevel: null, subjectId: null },
        ],
      },
      include: { grades: true },
    });
    const scale = scales
      .sort((a, b) => {
        const score = (item: typeof a) => (item.classLevel !== null ? 2 : 0) + (item.educationStage ? 1 : 0);
        return score(b) - score(a);
      })[0];
    const boundary = scale?.grades.find((grade) => avg >= grade.minScore && avg <= grade.maxScore);
    return boundary
      ? { grade: boundary.grade, points: boundary.points, remark: boundary.remark }
      : this.fallbackGradeFromAverage(avg);
  }

  private reportTemplateFor(stage: string | null, classLevel: number | null): string {
    if (stage === 'PRIMARY') return 'PRIMARY_STANDARD';
    if (stage === 'A_LEVEL' && classLevel === 6) return 'A_LEVEL_NATIONAL_READY';
    if (stage === 'A_LEVEL') return 'A_LEVEL_COMBINATION';
    if (stage === 'O_LEVEL' && classLevel === 4) return 'O_LEVEL_NATIONAL_READY';
    return 'O_LEVEL_TERM';
  }

  /**
   * Tanzania NECTA division calculation.
   *
   * O-Level CSEE: best 7 subjects by grade-point (A=1…F=5, lower is better).
   *   Points sum: 7-17 → Div I | 18-21 → Div II | 22-25 → Div III | 26-33 → Div IV | ≥34 → Div 0
   *
   * A-Level ACSEE: best 3 PRINCIPAL subjects by grade-point (A=5…E=1, S/F=0, higher is better).
   *   Points sum: 13-15 → Div I | 10-12 → Div II | 7-9 → Div III | 4-6 → Div IV | ≤3 → Div 0
   *   Requires ≥2 principal passes (grade point ≥1 i.e. E or better).
   *
   * Primary: every subject must pass for "Promotable"; otherwise "Needs intervention".
   */
  private divisionSummaryFor(
    stage: string | null,
    rows: Array<{ subjectId: string; grade: string; gradePoints: number; isPassing: boolean }>,
    principalSubjectIds?: Set<string>,
  ) {
    if (stage === 'PRIMARY') {
      const totalPoints = rows.reduce((sum, row) => sum + row.gradePoints, 0);
      return {
        mode: 'PRIMARY',
        descriptor: rows.every((row) => row.isPassing) ? 'Promotable' : 'Needs intervention',
        totalPoints,
      };
    }

    if (stage === 'A_LEVEL') {
      // Filter to principal subjects if roles are known; otherwise use all rows
      const principalRows = principalSubjectIds
        ? rows.filter((row) => principalSubjectIds.has(row.subjectId))
        : rows;
      const principalPasses = principalRows.filter((row) => row.gradePoints >= 1).length;
      const best3 = [...principalRows].sort((a, b) => b.gradePoints - a.gradePoints).slice(0, 3);
      const divPoints = best3.reduce((sum, row) => sum + row.gradePoints, 0);

      let division: string;
      if (principalPasses < 2 || divPoints <= 3) division = 'Division 0';
      else if (divPoints >= 13)                  division = 'Division I';
      else if (divPoints >= 10)                  division = 'Division II';
      else if (divPoints >= 7)                   division = 'Division III';
      else if (divPoints >= 4)                   division = 'Division IV';
      else                                       division = 'Division 0';

      return {
        mode: 'A_LEVEL',
        division,
        descriptor: principalPasses >= 2
          ? `${division} · ${principalPasses} principal pass(es) · ${divPoints} pts`
          : `Division 0 — only ${principalPasses} principal pass(es)`,
        principalPasses,
        totalPoints: divPoints,
      };
    }

    // O-Level CSEE: sort ascending (lower grade-points = better), take best 7
    const sorted = [...rows].sort((a, b) => a.gradePoints - b.gradePoints);
    const best7 = sorted.slice(0, 7);
    const divPoints = best7.reduce((sum, row) => sum + row.gradePoints, 0);
    const failing = rows.filter((row) => !row.isPassing).length;

    let division: string;
    if (best7.length < 7)      division = 'Ungraded';
    else if (divPoints <= 17)  division = 'Division I';
    else if (divPoints <= 21)  division = 'Division II';
    else if (divPoints <= 25)  division = 'Division III';
    else if (divPoints <= 33)  division = 'Division IV';
    else                       division = 'Division 0';

    return {
      mode: 'O_LEVEL',
      division,
      descriptor: `${division} · ${divPoints} pts · ${failing} failing subject(s)`,
      failingSubjects: failing,
      totalPoints: divPoints,
    };
  }

  async generateForClassTerm(classId: string, termId: string, actorId: string) {
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

    const averages = [...byStudent.entries()].map(([studentId, rows]) => ({
      studentId,
      average: rows.reduce((sum, item) => sum + item.weightedTotal, 0) / Math.max(rows.length, 1),
    }));

    const ranked = [...averages].sort((a, b) => b.average - a.average);
    const ranking = new Map(ranked.map((item, index) => [item.studentId, index + 1]));

    const alertsPayload = await this.studentClient.get<any>(
        '/students/performance/alerts',
      { classId, isResolved: false, severity: 'HIGH,CRITICAL' },
      { 'X-User-Id': actorId, 'X-User-Role': ROLES.PRINCIPAL },
    );

    const alertsData = this.unwrap<any>(alertsPayload);
    const alertItems = Array.isArray(alertsData?.items) ? alertsData.items : Array.isArray(alertsData) ? alertsData : [];
    const alertsByStudent = new Map<string, number>();
    for (const item of alertItems) {
      alertsByStudent.set(item.studentId, (alertsByStudent.get(item.studentId) ?? 0) + 1);
    }

    const saved: string[] = [];

    for (const [studentId, rows] of byStudent.entries()) {
      const avg = averages.find((item) => item.studentId === studentId)?.average ?? 0;
      const firstRow = rows[0];
      const resolved = await this.gradeFromAverage(avg, firstRow.academicYearId, {
        educationStage: firstRow.educationStage,
        classLevel: firstRow.classLevel,
      });
      const subjectCount = rows.length;
      const failingSubjectCount = rows.filter((item) => !item.isPassing).length;
      const reportTemplateCode = this.reportTemplateFor(firstRow.educationStage, firstRow.classLevel);
      const principalSubjectIds = firstRow.combinationId
        ? principalsByCombo.get(firstRow.combinationId)
        : undefined;
      const divisionSummary = this.divisionSummaryFor(firstRow.educationStage, rows, principalSubjectIds);

      const current = await this.prisma.reportCard.upsert({
        where: { studentId_termId: { studentId, termId } },
        create: {
          studentId,
          classId,
          educationStage: firstRow.educationStage,
          classLevel: firstRow.classLevel,
          combinationId: firstRow.combinationId,
          termId,
          academicYearId: firstRow.academicYearId,
          overallAverage: Number(avg.toFixed(2)),
          overallGrade: resolved.grade,
          overallPoints: resolved.points,
          overallRemark: resolved.remark,
          reportTemplateCode,
          divisionSummary,
          rank: ranking.get(studentId),
          totalStudentsInClass: byStudent.size,
          subjectCount,
          failingSubjectCount,
        },
        update: {
          educationStage: firstRow.educationStage,
          classLevel: firstRow.classLevel,
          combinationId: firstRow.combinationId,
          overallAverage: Number(avg.toFixed(2)),
          overallGrade: resolved.grade,
          overallPoints: resolved.points,
          overallRemark: resolved.remark,
          reportTemplateCode,
          divisionSummary,
          rank: ranking.get(studentId),
          totalStudentsInClass: byStudent.size,
          subjectCount,
          failingSubjectCount,
        },
      });

      const studentProfilePayload = await this.studentClient.get<any>(`/students/${studentId}`, undefined, {
        'X-User-Id': actorId,
        'X-User-Role': ROLES.PRINCIPAL,
      });

      const studentProfile = this.unwrap<any>(studentProfilePayload);
      const className = studentProfile?.enrolments?.[0]?.class?.name || classId;
      const attendancePayload = await this.studentClient.get<any>(
        `/students/attendance/summary/${studentId}`,
        {},
        { 'X-User-Id': actorId, 'X-User-Role': ROLES.PRINCIPAL },
      );
      const attendanceSummary = (this.unwrap<any[]>(attendancePayload) || []).find((item) => item.termId === termId);

      const performancePayload = await this.studentClient.get<any>(
        `/students/performance/${studentId}`,
        {},
        { 'X-User-Id': actorId, 'X-User-Role': ROLES.PRINCIPAL },
      );
      const performance = this.unwrap<any>(performancePayload);
      const hasActivePairing = Array.isArray(performance?.pairings)
        ? performance.pairings.some((item: any) => ['ACTIVE', 'SUGGESTED'].includes(item.status))
        : false;

      const pdfUrl = await this.pdfService.generatePdf({
        studentId,
        termId,
        academicYearId: firstRow.academicYearId,
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
            remark: row.remark,
          };
        }),
        average: avg,
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

    if ([ROLES.PARENT, ROLES.STUDENT].includes(user.role as any) && !reportCard.isPublished) {
      throw new ForbiddenException('Report card not published');
    }

    await this.redis.set(cacheKey, reportCard, 1800);
    return reportCard;
  }

  async getReportPdfPath(studentId: string, termId: string, user: RequestUser) {
    const reportCard = await this.getReportCard(studentId, termId, user);
    if (!reportCard.pdfUrl) {
      throw new NotFoundException('Report PDF not generated');
    }

    return reportCard.pdfUrl;
  }

  async updateComments(id: string, dto: UpdateCommentsDto, user: RequestUser) {
    const existing = await this.prisma.reportCard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report card not found');
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

    await this.generateForClassTerm(existing.classId, existing.termId, user.id);
    return updated;
  }
}
