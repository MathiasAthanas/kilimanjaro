import { Module } from '@nestjs/common';
import { FinanceSettingsController } from './finance-settings.controller';
import { FinanceSettingsService } from './finance-settings.service';

@Module({
  controllers: [FinanceSettingsController],
  providers: [FinanceSettingsService],
  exports: [FinanceSettingsService],
})
export class FinanceSettingsModule {}
