import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { Queue } from '@kilimanjaro/types';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.Connection;
  private channel: amqplib.Channel;
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      const url = this.config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();

      // Assert all queues this service will publish to
      await this.channel.assertQueue(Queue.AUTH_EVENTS, { durable: true });
      await this.channel.assertQueue(Queue.NOTIFICATION, { durable: true });

      this.logger.log('✅ RabbitMQ connected');
    } catch (error) {
      this.logger.error('❌ RabbitMQ connection failed', error);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  publish<T>(queue: Queue, event: string, data: T): void {
    const message = JSON.stringify({ event, data, timestamp: new Date() });
    this.channel?.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
    });
    this.logger.debug(`📤 Published [${event}] to ${queue}`);
  }
}
