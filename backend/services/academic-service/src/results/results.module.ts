import { Module, forwardRef } from '@nestjs/common';
import { AccessControlService } from '../common/helpers/access-control.service';
import { ReportCardsModule } from '../report-cards/report-cards.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [forwardRef(() => ReportCardsModule)],
  controllers: [ResultsController],
  providers: [ResultsService, AccessControlService],
  exports: [ResultsService],
})
export class ResultsModule {}
