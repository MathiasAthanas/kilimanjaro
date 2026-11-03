import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { TeacherWorkspaceService } from './teacher-workspace.service';

@ApiTags('Academic - Teacher workspace')
@Controller('academics/teacher')
export class TeacherWorkspaceController {
  constructor(private readonly workspace: TeacherWorkspaceService) {}

  @Get('workspace')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.SYSTEM_ADMIN)
  overview(@CurrentUser() user: RequestUser) {
    return this.workspace.overview(user);
  }

  @Get('class-subjects/:id/students')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.SYSTEM_ADMIN)
  students(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.workspace.classSubjectStudents(id, user);
  }

  @Get('class-subjects/:id/analytics')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.SYSTEM_ADMIN)
  analytics(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.workspace.classSubjectAnalytics(id, user);
  }

  @Get('analytics')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.SYSTEM_ADMIN)
  teachingAnalytics(@Query('academicYearId') academicYearId: string | undefined, @Query('termId') termId: string | undefined, @CurrentUser() user: RequestUser) {
    return this.workspace.teacherAnalytics(user, { academicYearId: academicYearId || undefined, termId: termId || undefined });
  }
}
