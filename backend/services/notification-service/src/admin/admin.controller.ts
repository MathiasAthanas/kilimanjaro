import { Body, Controller, Get, Query, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { DispatchService } from '../dispatch/dispatch.service';
import { ManualSendDto } from './dto/manual-send.dto';
import { AdminService } from './admin.service';

@ApiTags('Notifications - Admin')
@Controller('notifications')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly dispatch: DispatchService,
  ) {}

  @Get('logs')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  logs(@Query() query: any) {
    return this.adminService.logs(query);
  }

  @Get('logs/sms')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.FINANCE)
  smsLogs(@Query() query: any) {
    return this.adminService.smsLogs(query);
  }

  @Get('stats')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  stats() {
    return this.adminService.stats();
  }

  @Post('send-manual')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  sendManual(@Body() dto: ManualSendDto) {
    return this.dispatch.dispatchManual(dto.recipientIds, dto.channel, dto.subject, dto.body);
  }
}
