import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { FundRequestsController } from './fund-requests.controller';
import { FundRequestsService } from './fund-requests.service';

@Module({
  controllers: [FundRequestsController],
  providers: [FundRequestsService, NumberSequenceService],
  exports: [FundRequestsService],
})
export class FundRequestsModule {}
