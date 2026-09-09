import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ReportsService } from '../reports/reports.service';

@ApiTags('Finance - Dashboard')
@Controller('finance/dashboard')
export class DashboardController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR)
  dashboard(@CurrentUser() user?: RequestUser) {
    return this.reportsService.dashboard(user);
  }
}
