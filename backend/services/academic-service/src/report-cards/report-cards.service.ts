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

  private gradeFromAverage(avg: number): { grade: string; points: number; remark: string } {
    if (avg >= 80) return { grade: 'A', points: 4, remark: 'Excellent' };
    if (avg >= 70) return { grade: 'B+', points: 3.5, remark: 'Very Good' };
    if (avg >= 60) return { grade: 'B', points: 3, remark: 'Good' };
    if (avg >= 50) return { grade: 'C', points: 2, remark: 'Pass' };
    if (avg >= 40) return { grade: 'D', points: 1, remark: 'Low Pass' };
    return { grade: 'F', points: 0, remark: 'Fail' };
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

    const averages = [...byStudent.entries()].map(([studentId, rows]) => ({
      studentId,
      average: rows.reduce((sum, item) => sum + item.weightedTotal, 0) / Math.max(rows.length, 1),
    }));

    const ranked = [...averages].sort((a, b) => b.average - a.average);
    const ranking = new Map(ranked.map((item, index) => [item.studentId, index + 1]));

    const alertsPayload = await this.studentClient.get<any>(
      '/api/v1/students/performance/alerts',
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
      const resolved = this.gradeFromAverage(avg);
      const subjectCount = rows.length;
      const failingSubjectCount = rows.filter((item) => !item.isPassing).length;

      const current = await this.prisma.reportCard.upsert({
        where: { studentId_termId: { studentId, termId } },
        create: {
          studentId,
          classId,
          termId,
          academicYearId: rows[0].academicYearId,
          overallAverage: Number(avg.toFixed(2)),
          overallGrade: resolved.grade,
          overallPoints: resolved.points,
          overallRemark: resolved.remark,
          rank: ranking.get(studentId),
          totalStudentsInClass: byStudent.size,
          subjectCount,
          failingSubjectCount,
        },
        update: {
          overallAverage: Number(avg.toFixed(2)),
          overallGrade: resolved.grade,
          overallPoints: resolved.points,
          overallRemark: resolved.remark,
          rank: ranking.get(studentId),
          totalStudentsInClass: byStudent.size,
          subjectCount,
          failingSubjectCount,
        },
      });

      const studentProfilePayload = await this.studentClient.get<any>(`/api/v1/students/${studentId}`, undefined, {
        'X-User-Id': actorId,
        'X-User-Role': ROLES.PRINCIPAL,
      });

      const studentProfile = this.unwrap<any>(studentProfilePayload);
      const className = studentProfile?.enrolments?.[0]?.class?.name || classId;
      const attendancePayload = await this.studentClient.get<any>(
        `/api/v1/students/attendance/summary/${studentId}`,
        {},
        { 'X-User-Id': actorId, 'X-User-Role': ROLES.PRINCIPAL },
      );
      const attendanceSummary = (this.unwrap<any[]>(attendancePayload) || []).find((item) => item.termId === termId);

      const performancePayload = await this.studentClient.get<any>(
        `/api/v1/students/performance/${studentId}`,
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
        academicYearId: rows[0].academicYearId,
        studentName: `${studentProfile?.firstName || ''} ${studentProfile?.lastName || ''}`.trim() || studentId,
        registrationNumber: studentProfile?.registrationNumber || '-',
        className,
        generatedAt: new Date(),
        results: rows.map((row) => ({
          subjectName: row.subjectName,
          ...(row.assessmentScores as any),
          total: row.weightedTotal,
          grade: row.grade,
          remark: row.remark,
        })),
        average: avg,
        overallGrade: resolved.grade,
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
