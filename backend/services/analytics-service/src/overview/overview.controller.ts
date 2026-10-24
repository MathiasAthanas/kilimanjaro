import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { OverviewService } from './overview.service';
import { resolveScopeSchoolId } from '../common/helpers/school-scope.helper';

@ApiTags('Analytics - Overview')
@Controller('analytics/overview')
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.ACADEMIC_QA)
  get(@Query('academicYearId') academicYearId?: string, @CurrentUser() user?: RequestUser) {
    // Honour the selected school for group users too — a group admin who picks
    // a school must see that school's numbers, not the whole-group totals.
    const schoolId = resolveScopeSchoolId(user);
    return this.service.getOverview(academicYearId, schoolId);
  }
}
