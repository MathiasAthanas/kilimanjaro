import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Academic - Internal')
@Controller('academics/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('lifecycle-usage')
  async lifecycleUsage(
    @Query('studentIds') rawStudentIds = '',
    @Query('classId') classId?: string,
  ) {
    const studentIds = [...new Set(rawStudentIds.split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 500);
    const studentWhere = studentIds.length ? { studentId: { in: studentIds } } : { studentId: '__none__' };
    const [marks, results, reportCards, subjectEnrollments, interventions, classSubjects, classResults, classReportCards, classSubjectEnrollments, timetables] = await Promise.all([
      this.prisma.mark.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.termResult.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.reportCard.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.studentSubjectEnrollment.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      this.prisma.academicIntervention.findMany({ where: studentWhere, distinct: ['studentId'], select: { studentId: true } }),
      classId ? this.prisma.classSubject.count({ where: { classId } }) : Promise.resolve(0),
      classId ? this.prisma.termResult.count({ where: { classId } }) : Promise.resolve(0),
      classId ? this.prisma.reportCard.count({ where: { classId } }) : Promise.resolve(0),
      classId ? this.prisma.studentSubjectEnrollment.count({ where: { classId } }) : Promise.resolve(0),
      classId ? this.prisma.timetable.count({ where: { classId } }) : Promise.resolve(0),
    ]);
    const protectedStudentIds = [...new Set([
      ...marks, ...results, ...reportCards, ...subjectEnrollments, ...interventions,
    ].map((item) => item.studentId))];
    return {
      protectedStudentIds,
      counts: {
        marks: marks.length,
        termResults: results.length,
        reportCards: reportCards.length,
        subjectEnrollments: subjectEnrollments.length,
        interventions: interventions.length,
      },
      classRecords: {
        classSubjects,
        termResults: classResults,
        reportCards: classReportCards,
        subjectEnrollments: classSubjectEnrollments,
        timetables,
      },
    };
  }

  @Get('results/:studentId/term/:termId')
  async resultsByStudent(@Param('studentId') studentId: string, @Param('termId') termId: string) {
    return this.prisma.termResult.findMany({
      where: { studentId, termId },
      orderBy: { weightedTotal: 'desc' },
    });
  }

  @Get('class/:classId/term/:termId/published')
  async classTermPublished(@Param('classId') classId: string, @Param('termId') termId: string) {
    const total = await this.prisma.termResult.count({ where: { classId, termId } });
    const published = await this.prisma.termResult.count({ where: { classId, termId, isPublished: true } });
    return {
      classId,
      termId,
      total,
      published,
      isPublished: total > 0 && total === published,
    };
  }
}
