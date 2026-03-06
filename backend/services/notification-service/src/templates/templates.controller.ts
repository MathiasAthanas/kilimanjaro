import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PreviewTemplateDto, TemplateQueryDto, UpdateTemplateDto } from './dto/template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Notifications - Templates')
@Controller('notifications/templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  list(@Query() query: TemplateQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  byId(@Param('id') id: string) {
    return this.service.byId(id);
  }

  @Patch(':id')
  @Roles(ROLES.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user?: RequestUser) {
    return this.service.update(id, dto, user!.id);
  }

  @Post('preview')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL)
  preview(@Body() dto: PreviewTemplateDto) {
    return this.service.preview(dto);
  }
}
