import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { PreferencesService } from './preferences.service';

@ApiTags('Notifications - Preferences')
@Controller('notifications/preferences')
export class PreferencesController {
  constructor(private readonly service: PreferencesService) {}

  @Get()
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
  list(@CurrentUser() user?: RequestUser) {
    return this.service.list(user!.id);
  }

  @Patch()
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
  update(@Body() dto: UpdatePreferencesDto, @CurrentUser() user?: RequestUser) {
    return this.service.update(user!.id, dto);
  }
}
