import { Controller, Delete, Param, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { DeviceTokensService } from './device-tokens.service';
import { UpsertDeviceTokenDto } from './dto/device-token.dto';

@ApiTags('Notifications - Device Tokens')
@Controller('notifications/device-tokens')
export class DeviceTokensController {
  constructor(private readonly service: DeviceTokensService) {}

  @Post()
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.BOARD_DIRECTOR,
    ROLES.MANAGING_DIRECTOR,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.FINANCE,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  upsert(@Body() dto: UpsertDeviceTokenDto, @CurrentUser() user?: RequestUser) {
    return this.service.upsert(user!.id, dto);
  }

  @Delete(':token')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.BOARD_DIRECTOR,
    ROLES.MANAGING_DIRECTOR,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.FINANCE,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  remove(@Param('token') token: string, @CurrentUser() user?: RequestUser) {
    return this.service.deactivate(user!.id, token);
  }
}
