import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AttendanceService } from './attendance.service';

@ApiTags('Analytics - Attendance')
@ApiBearerAuth()
@Controller('analytics/attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get('overview')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR)
  @ApiOperation({ summary: 'Attendance overview analytics' })
  overview(@Query('termId') termId?: string, @Query('academicYearId') academicYearId?: string, @Query('classId') classId?: string) {
    return this.service.getOverview(termId, academicYearId, classId);
  }

  @Get('student/:studentId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.MANAGING_DIRECTOR,
    ROLES.FINANCE,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  @ApiOperation({ summary: 'Student attendance analytics' })
  student(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.service.getStudentAttendance(studentId, user);
  }
}