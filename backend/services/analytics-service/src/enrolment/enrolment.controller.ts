import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { EnrolmentService } from './enrolment.service';

@ApiTags('Analytics - Enrolment')
@Controller('analytics/enrolment')
export class EnrolmentController {
  constructor(private readonly service: EnrolmentService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  get(@Query('academicYearId') academicYearId?: string, @Query('termId') termId?: string) {
    return this.service.enrolment(academicYearId, termId);
  }

  @Get('trends/chart')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  chart() {
    return this.service.chart();
  }
}
