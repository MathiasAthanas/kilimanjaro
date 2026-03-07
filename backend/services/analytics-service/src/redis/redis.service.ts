import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(config.get<string>('REDIS_PORT', '6379')),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  private async ensureConnection() {
    if (this.client.status !== 'ready') {
      try { await this.client.connect(); } catch { }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection();
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch { return null; }
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    await this.ensureConnection();
    try { await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch {}
  }

  async del(...keys: string[]) {
    if (!keys.length) return;
    await this.ensureConnection();
    try { await this.client.del(...keys); } catch {}
  }

  async delByPattern(pattern: string) {
    await this.ensureConnection();
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 300);
        cursor = next;
        if (keys.length) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch {}
  }

  async onModuleDestroy() { await this.client.quit(); }
}
