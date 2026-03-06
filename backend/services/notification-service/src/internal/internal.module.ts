import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [DispatchModule, NotificationsModule],
  controllers: [InternalController],
})
export class InternalModule {}
