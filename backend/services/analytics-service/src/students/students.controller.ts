import { Controller, Get, Param, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { resolveScopeSchoolIds } from '../common/helpers/school-scope.helper';
import { StudentsService } from './students.service';

@ApiTags('Analytics - Students')
@ApiBearerAuth()
@Controller('analytics/students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER, ROLES.FINANCE, ROLES.HEAD_OF_FINANCE)
  @ApiOperation({ summary: 'Paginated student analytics list' })
  list(
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
    @Query('search') search?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('hasAlert') hasAlert?: string,
    @Query('isOverdue') isOverdue?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @CurrentUser() user?: RequestUser,
  ) {
    return this.service.list({
      classId,
      academicYearId,
      termId,
      search,
      riskLevel,
      hasAlert,
      isOverdue,
      page: Number(page),
      limit: Number(limit),
    }, resolveScopeSchoolIds(user));
  }

  @Get('at-risk')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  atRisk(@Query('classId') classId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.atRisk(classId, resolveScopeSchoolIds(user));
  }

  @Get('top-performers')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT)
  topPerformers(@Query('classId') classId?: string, @Query('subjectId') subjectId?: string, @Query('termId') termId?: string, @Query('limit') limit = '10', @CurrentUser() user?: RequestUser) {
    return this.service.topPerformers(classId, subjectId, termId, Number(limit), resolveScopeSchoolIds(user));
  }

  @Get('most-improved')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER, ROLES.FINANCE, ROLES.HEAD_OF_FINANCE)
  mostImproved(@Query('classId') classId?: string, @Query('subjectId') subjectId?: string, @Query('termId') termId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.mostImproved(classId, subjectId, termId, resolveScopeSchoolIds(user));
  }

  @Get('my-dashboard')
  @Roles(ROLES.STUDENT)
  @ApiOperation({ summary: 'Student personal learning dashboard' })
  myDashboard(
    @CurrentUser() user: RequestUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.service.myDashboard(user.id, academicYearId, termId);
  }

  @Get('parent-child/:childId')
  @Roles(ROLES.PARENT, ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: "Parent view of child's academic overview" })
  parentChildDashboard(
    @Param('childId') childId: string,
    @CurrentUser() user: RequestUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
  ) {
    const parentId = user.role === 'PARENT' ? user.id : childId;
    return this.service.parentChildDashboard(childId, parentId, academicYearId, termId);
  }

  @Get(':studentId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.FINANCE, ROLES.HEAD_OF_FINANCE,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  @ApiOperation({ summary: '360-degree student analytics profile' })
  profile(@Param('studentId') studentId: string, @Query('academicYearId') academicYearId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.getProfile(studentId, user, academicYearId);
  }
}
