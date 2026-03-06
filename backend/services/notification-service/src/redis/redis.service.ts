import { Global, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(configService.get<string>('REDIS_PORT', '6379')),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  private async ensureConnection() {
    if (this.client.status !== 'ready') {
      try {
        await this.client.connect();
      } catch {
        // cache should not fail service
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection();
    try {
      const v = await this.client.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    await this.ensureConnection();
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // noop
    }
  }

  async del(...keys: string[]) {
    if (!keys.length) return;
    await this.ensureConnection();
    try {
      await this.client.del(...keys);
    } catch {
      // noop
    }
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnection();
    try {
      const value = await this.client.exists(key);
      return value === 1;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
