import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqplib, { Channel } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: any;
  private channel?: Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    try {
      this.connection = await (amqplib as any).connect(url);
      this.channel = await this.connection.createChannel();
      const channel = this.channel!;
      await channel.assertExchange('student.events', 'topic', { durable: true });
      await channel.assertExchange('academic.events', 'topic', { durable: true });
      await channel.assertExchange('auth.events', 'topic', { durable: true });
    } catch (error) {
      this.logger.warn(`RabbitMQ connection failed: ${(error as Error).message}`);
    }
  }

  async createConsumerChannel(): Promise<Channel | undefined> {
    if (!this.connection) {
      await this.connect();
    }

    if (!this.connection) {
      return undefined;
    }

    return this.connection.createChannel();
  }

  async publish(routingKey: string, payload: unknown): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    if (!this.channel) {
      return;
    }

    this.channel.publish('student.events', routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
