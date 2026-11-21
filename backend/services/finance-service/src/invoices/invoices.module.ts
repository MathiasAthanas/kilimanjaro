import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';
import { FinanceSettingsModule } from '../finance-settings/finance-settings.module';
import { PaymentPlansModule } from '../payment-plans/payment-plans.module';

@Module({
  imports: [FinanceSettingsModule, PaymentPlansModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, NumberSequenceService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
