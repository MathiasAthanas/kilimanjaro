import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExemptionDto, ExemptionFilterDto, RevokeExemptionDto } from './dto/exemption.dto';
import { ExemptionsService } from './exemptions.service';

const ADMIN = [
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
] as const;

@ApiTags('Academic - Result Exemptions')
@Controller('academics/result-exemptions')
export class ExemptionsController {
  constructor(private readonly exemptions: ExemptionsService) {}

  @Get()
  @Roles(...ADMIN, ROLES.HEAD_OF_DEPARTMENT)
  list(@Query() filters: ExemptionFilterDto, @CurrentUser() user: RequestUser) {
    return this.exemptions.list(filters, user);
  }

  @Post('preview')
  @Roles(...ADMIN)
  preview(@Body() dto: CreateExemptionDto, @CurrentUser() user: RequestUser) {
    return this.exemptions.preview(dto, user);
  }

  @Post()
  @Roles(...ADMIN)
  create(@Body() dto: CreateExemptionDto, @CurrentUser() user: RequestUser) {
    return this.exemptions.create(dto, user);
  }

  @Post(':id/revoke')
  @Roles(...ADMIN)
  revoke(@Param('id') id: string, @Body() dto: RevokeExemptionDto, @CurrentUser() user: RequestUser) {
    return this.exemptions.revoke(id, dto, user);
  }
}
