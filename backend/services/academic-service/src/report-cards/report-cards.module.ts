import { Module, forwardRef } from '@nestjs/common';
import { AccessControlService } from '../common/helpers/access-control.service';
import { ResultsModule } from '../results/results.module';
import { GradingResolverModule } from '../exams/grading-resolver.module';
import { ReportCardPdfService } from './report-card-pdf.service';
import { ReportCardPolicyService } from './report-card-policy.service';
import { ReportCardBulkJobService } from './report-card-bulk-job.service';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';

@Module({
  imports: [forwardRef(() => ResultsModule), GradingResolverModule],
  controllers: [ReportCardsController],
  providers: [ReportCardsService, ReportCardPdfService, ReportCardPolicyService, ReportCardBulkJobService, AccessControlService],
  exports: [ReportCardsService, ReportCardPolicyService],
})
export class ReportCardsModule {}
