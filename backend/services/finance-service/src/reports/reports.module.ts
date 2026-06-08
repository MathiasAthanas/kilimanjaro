import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FinancialStatementService } from './financial-statement.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, FinancialStatementService],
})
export class ReportsModule {}
