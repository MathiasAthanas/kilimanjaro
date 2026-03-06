import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { NotificationsQueryDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

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
  list(@CurrentUser() user?: RequestUser, @Query() query?: NotificationsQueryDto) {
    return this.service.list(user!.id, query || {} as NotificationsQueryDto);
  }

  @Patch(':id/read')
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
  read(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.markRead(id, user!.id);
  }

  @Patch('read-all')
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
  readAll(@CurrentUser() user?: RequestUser) {
    return this.service.markAllRead(user!.id);
  }

  @Get('unread-count')
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
  unread(@CurrentUser() user?: RequestUser) {
    return this.service.unreadCount(user!.id).then((count) => ({ count }));
  }
}
