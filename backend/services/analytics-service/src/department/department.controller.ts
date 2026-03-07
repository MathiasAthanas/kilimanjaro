import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { DepartmentService } from './department.service';

@ApiTags('Analytics - Department')
@ApiBearerAuth()
@Controller('analytics/department')
export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  @Get(':subjectId')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Department analytics by subject' })
  get(@Param('subjectId') subjectId: string, @Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string) {
    return this.service.getDepartmentSubjectAnalytics(subjectId, academicYearId, termId);
  }
}
