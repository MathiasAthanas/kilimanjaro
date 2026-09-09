import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { GroupService } from './group.service';

const GROUP_ROLES = [ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN] as const;

@ApiTags('Analytics - Group')
@ApiBearerAuth()
@Controller('analytics/group')
export class GroupController {
  constructor(private readonly service: GroupService) {}

  @Get('overview')
  @Roles(...GROUP_ROLES, ROLES.HEAD_OF_FINANCE)
  @ApiOperation({ summary: 'Whole-group KPIs + per-school scorecards + attention list' })
  overview() {
    return this.service.overview();
  }

  @Get('schools')
  @Roles(...GROUP_ROLES, ROLES.HEAD_OF_FINANCE)
  @ApiOperation({ summary: 'Per-school scorecard rows' })
  schools() {
    return this.service.schools();
  }

  @Get('finance')
  @Roles(...GROUP_ROLES, ROLES.HEAD_OF_FINANCE)
  @ApiOperation({ summary: 'Consolidated finance across all schools' })
  finance() {
    return this.service.finance();
  }
}
