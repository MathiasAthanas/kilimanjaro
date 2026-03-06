import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Finance - Reports')
@Controller('finance/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('collection-summary')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  collectionSummary(@Query('termId') termId?: string, @Query('academicYearId') academicYearId?: string, @Query('classId') classId?: string) {
    return this.reportsService.collectionSummary({ termId, academicYearId, classId });
  }

  @Get('outstanding-balances')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR)
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
  statement(@Param('studentId') studentId: string, @Query('academicYearId') academicYearId?: string) {
    return this.reportsService.studentStatement(studentId, { academicYearId });
  }

  @Get('fee-defaulters')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR)
  defaulters(@Query('termId') termId?: string, @Query('academicYearId') academicYearId?: string, @Query('daysOverdue') daysOverdue?: string) {
    return this.reportsService.feeDefaulters({ termId, academicYearId, daysOverdue });
  }
}
