import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [DispatchModule],
  controllers: [AdminController],
})
export class AdminModule {}
