import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles';
import { OverviewService } from './overview.service';

@ApiTags('Analytics - Overview')
@Controller('analytics/overview')
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.ACADEMIC_QA)
  get(@Query('academicYearId') academicYearId?: string) {
    return this.service.getOverview(academicYearId);
  }
}
