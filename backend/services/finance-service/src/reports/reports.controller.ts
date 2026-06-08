import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ReportsService } from './reports.service';
import { FinancialStatementService, PeriodType } from './financial-statement.service';
import { toCsv, toPdf } from './financial-statement.export';

const STATEMENT_ROLES = [ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR];

@ApiTags('Finance - Reports')
@Controller('finance/reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly statementService: FinancialStatementService,
  ) {}

  @Get('financial-statement')
  @Roles(...STATEMENT_ROLES)
  statementJson(@Query('start') start?: string, @Query('end') end?: string, @Query('period') period?: PeriodType) {
    return this.statementService.build({ start, end, period });
  }

  @Get('financial-statement/pdf')
  @Roles(...STATEMENT_ROLES)
  async statementPdf(@Query('start') start?: string, @Query('end') end?: string, @Query('period') period?: PeriodType) {
    return toPdf(await this.statementService.build({ start, end, period }));
  }

  @Get('financial-statement/csv')
  @Roles(...STATEMENT_ROLES)
  async statementCsv(@Query('start') start?: string, @Query('end') end?: string, @Query('period') period?: PeriodType) {
    return toCsv(await this.statementService.build({ start, end, period }));
  }

  @Get('collection-summary')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  collectionSummary(@Query('termId') termId?: string, @Query('academicYearId') academicYearId?: string, @Query('classId') classId?: string) {
    return this.reportsService.collectionSummary({ termId, academicYearId, classId });
  }

  @Get('outstanding-balances')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  outstanding(
    @Query('termId') termId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('minAmount') minAmount?: string,
  ) {
    return this.reportsService.outstandingBalances({ termId, academicYearId, classId, minAmount });
  }

  @Get('daily-collections')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  daily(@Query('date') date?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reportsService.dailyCollections({ date, startDate, endDate });
  }

  @Get('student-statement/:studentId')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.PARENT, ROLES.STUDENT)
  statement(@Param('studentId') studentId: string, @Query('academicYearId') academicYearId?: string, @CurrentUser() user?: RequestUser) {
    return this.reportsService.studentStatement(studentId, { academicYearId }, user!);
  }

  @Get('fee-defaulters')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  defaulters(@Query('termId') termId?: string, @Query('academicYearId') academicYearId?: string, @Query('daysOverdue') daysOverdue?: string) {
    return this.reportsService.feeDefaulters({ termId, academicYearId, daysOverdue });
  }
}
