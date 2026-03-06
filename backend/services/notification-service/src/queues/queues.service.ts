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
    const [sms, email, push, inApp] = await Promise.all([
      this.sms.getJobCounts(),
      this.email.getJobCounts(),
      this.push.getJobCounts(),
      this.inApp.getJobCounts(),
    ]);

    return { sms, email, push, inApp };
  }

  async onModuleDestroy() {
    await Promise.all([this.sms.close(), this.email.close(), this.push.close(), this.inApp.close()]);
  }
}
