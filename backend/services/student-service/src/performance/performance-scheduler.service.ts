import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PerformanceEngineService } from './performance-engine.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class PerformanceSchedulerService {
  private readonly logger = new Logger(PerformanceSchedulerService.name);

  constructor(
    private readonly engine: PerformanceEngineService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  @Cron('0 2 * * *')
  async nightlyFullAnalysis(): Promise<void> {
    const start = Date.now();
    this.logger.log('Nightly full analysis started');

    const stats = await this.engine.runScope('all');

    const duration = Date.now() - start;
    this.logger.log(
      `Nightly full analysis completed in ${duration}ms students=${stats.studentsProcessed} alertsCreated=${stats.alertsCreated} alertsResolved=${stats.alertsResolved} pairings=${stats.pairingsCreated}`,
    );

    await this.rabbitMq.publish('engine.analysis.completed', {
      studentsProcessed: stats.studentsProcessed,
      alertsCreated: stats.alertsCreated,
      alertsResolved: stats.alertsResolved,
      pairingsCreated: stats.pairingsCreated,
      duration,
    });
  }

  @Cron('0 3 * * *')
  async expireStalePairings(): Promise<void> {
    const start = Date.now();
    this.logger.log('Pairing expiry job started');
    const expired = await this.engine.expireStalePairings();
    this.logger.log(`Pairing expiry completed, expired=${expired}, duration=${Date.now() - start}ms`);
  }

  @Cron('0 7 * * 1')
  async weeklyDigest(): Promise<void> {
    const start = Date.now();
    this.logger.log('Weekly digest job started');
    await this.engine.weeklyDigest();
    this.logger.log(`Weekly digest job completed in ${Date.now() - start}ms`);
  }

  @Cron('0 4 * * 0')
  async attendanceImpactCheck(): Promise<void> {
    const start = Date.now();
    this.logger.log('Attendance correlation check started');
    await this.engine.attendanceCorrelationCheck();
    this.logger.log(`Attendance correlation check completed in ${Date.now() - start}ms`);
  }
}
