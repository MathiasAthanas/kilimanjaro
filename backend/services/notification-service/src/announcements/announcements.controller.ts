import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@ApiTags('Notifications - Announcements')
@Controller('notifications/announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user!);
  }

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER, ROLES.ACADEMIC_QA, ROLES.FINANCE)
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Get('active')
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
  active(@CurrentUser() user?: RequestUser) {
    return this.service.activeForRole(user!.role);
  }

  @Patch(':id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGING_DIRECTOR, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user?: RequestUser) {
    return this.service.update(id, dto, user!);
  }

  @Patch(':id/cancel')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
