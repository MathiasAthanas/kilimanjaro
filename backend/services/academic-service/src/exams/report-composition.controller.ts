import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ComposeReportCardsDto } from './dto/compose-report-cards.dto';
import { ReportCompositionService } from './report-composition.service';

const ADMIN = [
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
] as const;

@ApiTags('Academic - Report Card Composition')
@Controller('academics')
export class ReportCompositionController {
  constructor(private readonly composition: ReportCompositionService) {}

  @Post('report-card-compositions')
  @Roles(...ADMIN)
  compose(@Body() dto: ComposeReportCardsDto, @CurrentUser() user: RequestUser) {
    return this.composition.compose(dto, user);
  }

  @Get('report-card-compositions')
  @Roles(...ADMIN)
  list(@Query('termId') termId: string | undefined, @CurrentUser() user: RequestUser) {
    return this.composition.list(termId, user);
  }

  @Get('report-card-compositions/:id')
  @Roles(...ADMIN)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.composition.detail(id, user);
  }
}
