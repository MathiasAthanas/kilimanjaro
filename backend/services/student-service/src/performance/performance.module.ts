import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceEngineService } from './performance-engine.service';
import { PerformanceSchedulerService } from './performance-scheduler.service';
import { RabbitMqConsumer } from '../rabbitmq/rabbitmq.consumer';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService, PerformanceEngineService, PerformanceSchedulerService, RabbitMqConsumer],
  exports: [PerformanceService, PerformanceEngineService],
})
export class PerformanceModule {}
