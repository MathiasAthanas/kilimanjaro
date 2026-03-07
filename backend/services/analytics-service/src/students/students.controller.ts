import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { StudentsService } from './students.service';

@ApiTags('Analytics - Students')
@ApiBearerAuth()
@Controller('analytics/students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER, ROLES.FINANCE)
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
    });
  }

  @Get('at-risk')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  atRisk(@Query('classId') classId?: string) {
    return this.service.atRisk(classId);
  }

  @Get('top-performers')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT)
  topPerformers(@Query('classId') classId?: string, @Query('subjectId') subjectId?: string, @Query('termId') termId?: string, @Query('limit') limit = '10') {
    return this.service.topPerformers(classId, subjectId, termId, Number(limit));
  }

  @Get('most-improved')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER, ROLES.FINANCE)
  mostImproved(@Query('classId') classId?: string, @Query('subjectId') subjectId?: string, @Query('termId') termId?: string) {
    return this.service.mostImproved(classId, subjectId, termId);
  }

  @Get(':studentId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.FINANCE,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  @ApiOperation({ summary: '360-degree student analytics profile' })
  profile(@Param('studentId') studentId: string, @Query('academicYearId') academicYearId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.getProfile(studentId, user, academicYearId);
  }
}
