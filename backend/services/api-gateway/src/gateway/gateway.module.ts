import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import {
  AuthProxyController,
  StudentProxyController,
  AcademicProxyController,
  FinanceProxyController,
  AnalyticsProxyController,
  NotificationProxyController,
} from './gateway.controller';
import { GatewayService } from './gateway.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Module({
  imports: [HttpModule],
  controllers: [
    AuthProxyController,
    StudentProxyController,
    AcademicProxyController,
    FinanceProxyController,
    AnalyticsProxyController,
    NotificationProxyController,
  ],
  providers: [GatewayService, AuthGuard],
  exports: [GatewayService],
})
export class GatewayModule {}
