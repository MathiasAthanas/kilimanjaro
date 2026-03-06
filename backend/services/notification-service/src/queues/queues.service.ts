import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

@Injectable()
export class QueuesService implements OnModuleDestroy {
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
    await this.sms.add('send-sms', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
  }

  async addEmail(data: any) {
    await this.email.add('send-email', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
  }

  async addPush(data: any) {
    await this.push.add('send-push', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
  }

  async addInApp(data: any) {
    await this.inApp.add('send-inapp', data, { attempts: 1 });
  }

  async stats() {
    try {
      const withTimeout = <T>(promise: Promise<T>) =>
        Promise.race<T>([
          promise,
          new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('queue stats timeout')), 2000)),
        ]);

      const [sms, email, push, inApp] = await Promise.all([
        withTimeout(this.sms.getJobCounts()),
        withTimeout(this.email.getJobCounts()),
        withTimeout(this.push.getJobCounts()),
        withTimeout(this.inApp.getJobCounts()),
      ]);

      return { sms, email, push, inApp };
    } catch {
      return {
        sms: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        email: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        push: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        inApp: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
      };
    }
  }

  async onModuleDestroy() {
    await Promise.all([this.sms.close(), this.email.close(), this.push.close(), this.inApp.close()]);
  }
}
