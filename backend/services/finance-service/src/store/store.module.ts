import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  controllers: [StoreController],
  providers: [StoreService, NumberSequenceService],
  exports: [StoreService],
})
export class StoreModule {}
