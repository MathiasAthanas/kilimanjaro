import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptPdfService, NumberSequenceService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
