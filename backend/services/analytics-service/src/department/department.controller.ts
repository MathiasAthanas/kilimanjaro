import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { resolveScopeSchoolIds } from '../common/helpers/school-scope.helper';
import { DepartmentService } from './department.service';

@ApiTags('Analytics - Department')
@ApiBearerAuth()
@Controller('analytics/department')
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  @Get(':subjectId')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA, ROLES.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Department analytics by subject' })
  get(@Param('subjectId') subjectId: string, @Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.getDepartmentSubjectAnalytics(subjectId, academicYearId, termId, resolveScopeSchoolIds(user));
  }
}
