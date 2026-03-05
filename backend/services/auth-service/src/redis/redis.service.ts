import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private enabled = true;
  private readonly memoryStore = new Map<string, { value: string; expiresAt?: number }>();

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
      this.logger.warn(`Redis unavailable; continuing without Redis features (${(error as Error).message})`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async get(key: string): Promise<string | null> {
    if (this.enabled) {
      return this.client.get(key);
    }

    this.cleanupExpiredMemoryKey(key);
    return this.memoryStore.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.enabled) {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      }
      await this.client.set(key, value);
      return;
    }

    this.memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.enabled) {
      await this.client.del(key);
      return;
    }

    this.memoryStore.delete(key);
  }

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    if (this.enabled) {
      const value = await this.client.incr(key);
      if (value === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return value;
    }

    this.cleanupExpiredMemoryKey(key);
    const current = Number(this.memoryStore.get(key)?.value ?? '0') + 1;
    this.memoryStore.set(key, { value: String(current), expiresAt: Date.now() + ttlSeconds * 1000 });
    return current;
  }

  private cleanupExpiredMemoryKey(key: string): void {
    const existing = this.memoryStore.get(key);
    if (!existing?.expiresAt) {
      return;
    }
    if (existing.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
    }
  }
}
