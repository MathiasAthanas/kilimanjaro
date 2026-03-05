import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private enabled = true;
  private readonly memory = new Map<string, { value: string; exp?: number }>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = Number(this.configService.get<string>('REDIS_PORT', '6379'));
      const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

      this.client = new Redis({ host, port, password, lazyConnect: true, maxRetriesPerRequest: 2 });
      await this.client.connect();
      this.logger.log(`Redis connected at ${host}:${port}`);
    } catch (error) {
      this.enabled = false;
      this.logger.warn(`Redis unavailable, using in-memory fallback: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.enabled) {
      return this.client.get(key);
    }

    this.cleanup(key);
    return this.memory.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.enabled) {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }

    this.memory.set(key, {
      value,
      exp: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.enabled) {
      await this.client.del(key);
      return;
    }

    this.memory.delete(key);
  }

  private cleanup(key: string): void {
    const entry = this.memory.get(key);
    if (!entry?.exp) {
      return;
    }
    if (entry.exp <= Date.now()) {
      this.memory.delete(key);
    }
  }
}
