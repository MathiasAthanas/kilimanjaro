import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GatewayUser } from '../ui/ui-api.service';

export interface OperationRecord {
  id: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

@Injectable()
export class OperationsStoreService {
  private readonly dataDir: string;

  constructor(private readonly configService: ConfigService) {
    this.dataDir = this.configService.get<string>('KILIMANJARO_DATA_DIR')
      || path.join(process.cwd(), 'data');
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  list<T extends OperationRecord>(collection: string): T[] {
    return this.read<T>(collection);
  }

  get<T extends OperationRecord>(collection: string, id: string): T | undefined {
    return this.read<T>(collection).find((item) => item.id === id);
  }

  create<T extends OperationRecord>(
    collection: string,
    input: Record<string, unknown>,
    user?: GatewayUser,
  ): T {
    const now = new Date().toISOString();
    const record = {
      id: String(input.id || crypto.randomUUID()),
      ...input,
      createdAt: String(input.createdAt || now),
      updatedAt: now,
      createdById: input.createdById || user?.id,
      createdByRole: input.createdByRole || user?.role,
    } as unknown as T;

    const items = this.read<T>(collection);
    items.unshift(record);
    this.write(collection, items);
    return record;
  }

  update<T extends OperationRecord>(collection: string, id: string, patch: Record<string, unknown>): T {
    const items = this.read<T>(collection);
    const index = items.findIndex((item) => item.id === id);
    const now = new Date().toISOString();
    const current = index >= 0 ? items[index] : ({ id, createdAt: now } as T);
    const next = { ...current, ...patch, id, updatedAt: now } as T;

    if (index >= 0) {
      items[index] = next;
    } else {
      items.unshift(next);
    }

    this.write(collection, items);
    return next;
  }

  remove<T extends OperationRecord>(collection: string, id: string): T | undefined {
    const items = this.read<T>(collection);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    const [removed] = items.splice(index, 1);
    this.write(collection, items);
    return removed;
  }

  appendAudit(input: Record<string, unknown>, user?: GatewayUser): OperationRecord {
    return this.create('audit-events', {
      service: 'api-gateway',
      action: input.action || 'EVENT_RECORDED',
      entityType: input.entityType || 'system',
      entityId: input.entityId,
      actorId: input.actorId || user?.id,
      actorRole: input.actorRole || user?.role,
      actorEmail: input.actorEmail || user?.email,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      metadataJson: input.metadataJson || input.metadata || {},
    }, user);
  }

  private read<T>(collection: string): T[] {
    const file = this.filePath(collection);
    if (!fs.existsSync(file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write<T>(collection: string, items: T[]): void {
    const file = this.filePath(collection);
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(items, null, 2));
    fs.renameSync(temp, file);
  }

  private filePath(collection: string): string {
    const safe = collection.replace(/[^a-z0-9_.-]/gi, '-');
    return path.join(this.dataDir, `${safe}.json`);
  }
}
