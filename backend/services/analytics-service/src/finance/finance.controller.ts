import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { FinanceAnalyticsService } from './finance.service';

@ApiTags('Analytics - Finance')
@ApiBearerAuth()
@Controller('analytics/finance')
export class FinanceController {
  constructor(private readonly service: FinanceAnalyticsService) {}

  @Get('overview')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE)
  @ApiOperation({ summary: 'Finance overview analytics' })
  @ApiResponse({ status: 200 })
  overview(@Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string) {
    return this.service.getOverview(academicYearId, termId);
  }

  @Get('revenue-forecast')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  @ApiOperation({ summary: 'Revenue forecast analytics' })
  forecast(@Query('academicYearId') academicYearId?: string) {
    return this.service.getRevenueForecast(academicYearId);
  }

  @Get('assets-summary')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.PRINCIPAL)
  @ApiOperation({ summary: 'Assets summary analytics' })
  assets() {
    return this.service.getAssetsSummary();
  }
}