import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { TeacherAnalyticsService } from './teacher.service';

@ApiTags('Analytics - Teacher')
@ApiBearerAuth()
@Controller('analytics/teacher')
export class TeacherAnalyticsController {
  constructor(private readonly service: TeacherAnalyticsService) {}

  @Get('my-dashboard')
  @Roles(ROLES.TEACHER, ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Teacher personal analytics dashboard' })
  myDashboard(
    @CurrentUser() user: RequestUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    const resolvedId = (user.role === 'TEACHER' ? user.id : teacherId) || user.id;
    return this.service.myDashboard(resolvedId, academicYearId, termId);
  }
}
