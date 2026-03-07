import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { AcademicService } from './academic.service';

@ApiTags('Analytics - Academic')
@ApiBearerAuth()
@Controller('analytics/academic')
export class AcademicController {
  constructor(private readonly service: AcademicService) {}

  @Get('overview')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  @ApiOperation({ summary: 'School academic overview analytics' })
  @ApiResponse({ status: 200 })
  overview(@Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string) {
    return this.service.getOverview(academicYearId, termId);
  }

  @Get('subject/:subjectId')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  @ApiOperation({ summary: 'Subject-level analytics' })
  subject(
    @Param('subjectId') subjectId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.service.getSubject(subjectId, academicYearId, termId, classId);
  }

  @Get('teacher/:teacherId')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Teacher performance analytics' })
  teacher(
    @Param('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.service.getTeacher(teacherId, academicYearId, termId);
  }

  @Get('class/:classId')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  @ApiOperation({ summary: 'Class academic analytics' })
  classAnalytics(
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.service.getClass(classId, academicYearId, termId);
  }

  @Get('performance-engine')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR)
  @ApiOperation({ summary: 'Performance engine effectiveness' })
  performanceEngine(@Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string) {
    return this.service.getPerformanceEngine(academicYearId, termId);
  }
}