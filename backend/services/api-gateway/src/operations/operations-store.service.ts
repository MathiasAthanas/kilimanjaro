import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaClient } from '../../generated/prisma';
import { GatewayUser } from '../ui/ui-api.service';

export interface OperationRecord {
  id: string;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

@Injectable()
export class OperationsStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationsStoreService.name);
  private readonly prisma = new PrismaClient();
  private readonly cache = new Map<string, OperationRecord[]>();
  private writeQueue = Promise.resolve();

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
    await this.reload();
  }

  async onModuleDestroy(): Promise<void> {
    await this.writeQueue.catch(() => undefined);
    await this.prisma.$disconnect();
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
    return ([...(this.cache.get(collection) || [])] as unknown) as T[];
  }

  private write<T>(collection: string, items: T[]): void {
    this.cache.set(collection, ([...(items as OperationRecord[])]));
    this.enqueuePersist(collection, items as OperationRecord[]);
  }

  private enqueuePersist(collection: string, items: OperationRecord[]): void {
    this.writeQueue = this.writeQueue
      .then(() => this.persistCollection(collection, items))
      .catch((error) => {
        this.logger.error(`Failed to persist operations collection "${collection}"`, error instanceof Error ? error.stack : String(error));
      });
  }

  private async persistCollection(collection: string, items: OperationRecord[]): Promise<void> {
    const ids = items.map((item) => item.id);
    await this.prisma.$transaction([
      this.prisma.operationRecord.deleteMany({
        where: ids.length
          ? { collection, id: { notIn: ids } }
          : { collection },
      }),
      ...items.map((item) => this.prisma.operationRecord.upsert({
        where: { collection_id: { collection, id: item.id } },
        update: {
          data: item as unknown as object,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
        create: {
          collection,
          id: item.id,
          data: item as unknown as object,
          createdAt: new Date(item.createdAt),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      })),
    ]);
  }

  private async reload(): Promise<void> {
    const rows = await this.prisma.operationRecord.findMany({
      orderBy: [{ collection: 'asc' }, { updatedAt: 'desc' }],
    });

    const next = new Map<string, OperationRecord[]>();
    for (const row of rows) {
      const record = row.data as unknown as OperationRecord;
      const items = next.get(row.collection) || [];
      items.push({
        ...record,
        id: record.id || row.id,
        createdAt: record.createdAt || row.createdAt.toISOString(),
        updatedAt: record.updatedAt || row.updatedAt.toISOString(),
      });
      next.set(row.collection, items);
    }

    this.cache.clear();
    for (const [collection, items] of next.entries()) {
      this.cache.set(collection, items);
    }
  }
}
