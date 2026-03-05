import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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

    this.client.on('error', (error) => this.logger.warn(`Redis error: ${error.message}`));
  }

  private async ensureConnection(): Promise<void> {
    if (this.client.status !== 'ready') {
      try {
        await this.client.connect();
      } catch {
        // ignored intentionally; cache must not crash service
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection();
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // ignored intentionally
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.ensureConnection();
    try {
      await this.client.del(...keys);
    } catch {
      // ignored intentionally
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    await this.ensureConnection();

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // ignored intentionally
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}