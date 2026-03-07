import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { ExecutiveService } from './executive.service';

@ApiTags('Analytics - Executive')
@ApiBearerAuth()
@Controller('analytics/executive')
export class ExecutiveController {
  constructor(private readonly service: ExecutiveService) {}

  @Get('board')
  @Roles(ROLES.BOARD_DIRECTOR, ROLES.MANAGING_DIRECTOR, ROLES.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Board executive dashboard' })
  board(@Query('academicYearId') academicYearId?: string) {
    return this.service.boardDashboard(academicYearId);
  }

  @Get('managing-director')
  @Roles(ROLES.MANAGING_DIRECTOR, ROLES.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Managing director dashboard' })
  managingDirector(@Query('academicYearId') academicYearId?: string) {
    return this.service.managingDirectorDashboard(academicYearId);
  }
}
