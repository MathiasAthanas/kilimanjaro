import { schoolEvent, requireSchool } from '@kilimanjaro/security';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueuesService implements OnModuleDestroy {
  private readonly logger = new Logger(QueuesService.name);
  readonly sms: Queue;
  readonly email: Queue;
  readonly push: Queue;
  readonly inApp: Queue;

  constructor(config: ConfigService) {
    const connection = {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(config.get<string>('REDIS_PORT', '6379')),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
    };

    this.sms = new Queue(QUEUE_NAMES.SMS, { connection });
    this.email = new Queue(QUEUE_NAMES.EMAIL, { connection });
    this.push = new Queue(QUEUE_NAMES.PUSH, { connection });
    this.inApp = new Queue(QUEUE_NAMES.IN_APP, { connection });
  }

  async addSms(data: any) {
    try {
      await this.sms.add('send-sms', schoolEvent(data), { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    } catch (e) {
      this.logger.warn(`SMS queue unavailable: ${(e as Error).message}`);
    }
  }

  async addEmail(data: any) {
    try {
      await this.email.add('send-email', schoolEvent(data), { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    } catch (e) {
      this.logger.warn(`Email queue unavailable: ${(e as Error).message}`);
    }
  }

  async addPush(data: any) {
    try {
      await this.push.add('send-push', schoolEvent(data), { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
    } catch (e) {
      this.logger.warn(`Push queue unavailable: ${(e as Error).message}`);
    }
  }

  async addInApp(data: any) {
    try {
      await this.inApp.add('send-inapp', schoolEvent(data), { attempts: 1 });
    } catch (e) {
      this.logger.warn(`In-app queue unavailable: ${(e as Error).message}`);
    }
  }

  async stats() {
    const schoolId = requireSchool();
    const count = async (queue: Queue) => {
      const counts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
      for (const state of Object.keys(counts) as (keyof typeof counts)[]) {
        // Shared worker queues contain several schools. Count only this school's
        // jobs, in pages, instead of exposing Redis-wide getJobCounts().
        for (let start = 0; ; start += 250) {
          const jobs = await queue.getJobs([state], start, start + 249);
          counts[state] += jobs.filter(job => job?.data?.schoolId === schoolId).length;
          if (jobs.length < 250) break;
        }
      }
      return counts;
    };
    const [sms, email, push, inApp] = await Promise.all([this.sms, this.email, this.push, this.inApp].map(count));
    return { sms, email, push, inApp };
  }

  async onModuleDestroy() {
    await Promise.all([this.sms.close(), this.email.close(), this.push.close(), this.inApp.close()]);
  }
}
