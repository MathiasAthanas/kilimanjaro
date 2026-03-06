import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, NumberSequenceService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
