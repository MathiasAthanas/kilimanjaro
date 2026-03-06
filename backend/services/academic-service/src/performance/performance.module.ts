import { Module } from '@nestjs/common';
import { AccessControlService } from '../common/helpers/access-control.service';
import { InterventionsService } from './interventions.service';
import { PerformanceController } from './performance.controller';
import { PerformanceProxyService } from './performance-proxy.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceProxyService, InterventionsService, AccessControlService],
})
export class PerformanceModule {}
