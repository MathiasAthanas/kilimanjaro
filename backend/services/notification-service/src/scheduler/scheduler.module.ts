import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { DownstreamModule } from '../downstream/downstream.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [AnnouncementsModule, DispatchModule, DownstreamModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
