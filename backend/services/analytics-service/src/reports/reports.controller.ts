import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { GenerateReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Analytics - Reports')
@ApiBearerAuth()
@Controller('analytics/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post('generate')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE)
  @ApiOperation({ summary: 'Generate report asynchronously' })
  generate(@Body() body: GenerateReportDto, @CurrentUser() user?: RequestUser) {
    return this.service.generateReport(body, user || { id: 'unknown', role: 'SYSTEM_ADMIN' });
  }

  @Get()
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  list(
    @CurrentUser() user?: RequestUser,
    @Query('reportType') reportType?: string,
    @Query('status') status?: string,
    @Query('generatedById') generatedById?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.listReports(user, reportType, status, generatedById, Number(page), Number(limit));
  }

  @Get(':id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  detail(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.service.getReport(id, user);
  }

  @Get(':id/download')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR, ROLES.FINANCE, ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  async download(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const file = await this.service.getDownloadPath(id, user);
    res.download(file);
  }
}
