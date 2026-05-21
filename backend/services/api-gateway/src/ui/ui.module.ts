import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UiController } from './ui.controller';
import { UiApiService } from './ui-api.service';

@Module({
  imports: [HttpModule],
  controllers: [UiController],
  providers: [UiApiService],
})
export class UiModule {}
