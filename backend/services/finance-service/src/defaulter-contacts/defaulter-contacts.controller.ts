import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { DefaulterContactsService } from './defaulter-contacts.service';
import { CreateDefaulterContactDto } from './dto/create-contact.dto';

@ApiTags('Finance - Defaulter follow-up')
@Controller('finance/defaulter-contacts')
export class DefaulterContactsController {
  constructor(private readonly service: DefaulterContactsService) {}

  @Get()
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN)
  list(@Query('studentId') studentId?: string, @CurrentUser() user?: RequestUser) {
    return this.service.list(user!, studentId);
  }

  @Post()
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN)
  create(@Body() dto: CreateDefaulterContactDto, @CurrentUser() user?: RequestUser) {
    return this.service.create(dto, user!);
  }
}
