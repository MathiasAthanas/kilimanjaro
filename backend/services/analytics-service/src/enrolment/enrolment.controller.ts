import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { resolveScopeSchoolIds } from '../common/helpers/school-scope.helper';
import { EnrolmentService } from './enrolment.service';

@ApiTags('Analytics - Enrolment')
@Controller('analytics/enrolment')
export class EnrolmentController {
  constructor(private readonly service: EnrolmentService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  get(@Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.enrolment(academicYearId, termId, resolveScopeSchoolIds(user));
  }

  @Get('trends/chart')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  chart(@CurrentUser() user?: RequestUser) {
    return this.service.chart(resolveScopeSchoolIds(user));
  }
}
