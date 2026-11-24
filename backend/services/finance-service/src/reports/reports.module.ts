import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FinancialStatementService } from './financial-statement.service';
import { StudentStatementPdfService } from './student-statement-pdf.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, FinancialStatementService, StudentStatementPdfService],
  exports: [ReportsService],
})
export class ReportsModule {}
