import { Module } from '@nestjs/common';
import { NumberSequenceService } from '../common/helpers/number-sequence.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, NumberSequenceService],
})
export class AssetsModule {}
