import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { ReceiptsModule } from '../receipts/receipts.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [ReceiptsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, NumberSequenceService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
