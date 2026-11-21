import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { BulkClassifyDto, ChangeResidenceDto, ResidenceStudentsQueryDto } from './residence.dto';
import { ResidenceService } from './residence.service';

/** Who may reclassify students: the setup roles plus the admissions office. */
const CLASSIFY = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'ADMISSIONS'] as const;
/** Who may look at the classification and its history (finance needs it to review invoices). */
const VIEW = [...CLASSIFY, 'FINANCE', 'HEAD_OF_FINANCE'] as const;

@Controller('residence')
@UseGuards(RolesGuard)
export class ResidenceController {
  constructor(private readonly service: ResidenceService) {}

  @Get('summary') @Roles(...VIEW)
  summary(@CurrentUser() user?: RequestUser) { return this.service.summary(user); }

  @Get('students') @Roles(...VIEW)
  students(@Query() query: ResidenceStudentsQueryDto, @CurrentUser() user?: RequestUser) { return this.service.students(query, user); }

  @Post('bulk') @Roles(...CLASSIFY)
  bulk(@Body() dto: BulkClassifyDto, @CurrentUser() user?: RequestUser) { return this.service.bulkClassify(dto, user); }

  @Post('apply-due') @Roles('SYSTEM_ADMIN', 'SUPER_ADMIN', 'MANAGER')
  applyDue() { return this.service.applyDueScheduled(); }

  @Get('students/:id/history') @Roles(...VIEW)
  history(@Param('id') id: string, @CurrentUser() user?: RequestUser) { return this.service.history(id, user); }

  @Post('students/:id/change') @Roles(...CLASSIFY)
  change(@Param('id') id: string, @Body() dto: ChangeResidenceDto, @CurrentUser() user?: RequestUser) { return this.service.change(id, dto, user); }

  @Patch('changes/:changeId/cancel') @Roles(...CLASSIFY)
  cancel(@Param('changeId') changeId: string, @CurrentUser() user?: RequestUser) { return this.service.cancelScheduled(changeId, user); }
}
