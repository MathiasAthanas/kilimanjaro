import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { resolveScopeSchoolIds } from '../common/helpers/school-scope.helper';
import { FinanceAnalyticsService } from './finance.service';

@ApiTags('Analytics - Finance')
@ApiBearerAuth()
@Controller('analytics/finance')
export class FinanceController {
  constructor(private readonly service: FinanceAnalyticsService) {}

  @Get('overview')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.HEAD_OF_FINANCE)
  @ApiOperation({ summary: 'Finance overview analytics' })
  @ApiResponse({ status: 200 })
  overview(@Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.getOverview(academicYearId, termId, resolveScopeSchoolIds(user));
  }

  @Get('revenue-forecast')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  @ApiOperation({ summary: 'Revenue forecast analytics' })
  forecast(@Query('academicYearId') academicYearId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.getRevenueForecast(academicYearId, resolveScopeSchoolIds(user));
  }

  @Get('assets-summary')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assets summary analytics' })
  assets(@CurrentUser() user?: RequestUser) {
    return this.service.getAssetsSummary(resolveScopeSchoolIds(user));
  }
}