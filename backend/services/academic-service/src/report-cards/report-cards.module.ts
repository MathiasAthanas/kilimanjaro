import { Module, forwardRef } from '@nestjs/common';
import { AccessControlService } from '../common/helpers/access-control.service';
import { ResultsModule } from '../results/results.module';
import { ReportCardPdfService } from './report-card-pdf.service';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';

@Module({
  imports: [forwardRef(() => ResultsModule)],
  controllers: [ReportCardsController],
  providers: [ReportCardsService, ReportCardPdfService, AccessControlService],
  exports: [ReportCardsService],
})
export class ReportCardsModule {}
