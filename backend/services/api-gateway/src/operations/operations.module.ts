import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OperationsController } from './operations.controller';
import { OperationsStoreService } from './operations-store.service';
import { UiApiService } from '../ui/ui-api.service';

@Module({
  imports: [HttpModule],
  controllers: [OperationsController],
  providers: [OperationsStoreService, UiApiService],
})
export class OperationsModule {}
