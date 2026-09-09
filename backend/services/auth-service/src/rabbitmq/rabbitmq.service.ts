import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.ChannelModel;
  private channel: amqplib.Channel;
  private readonly exchange = 'auth.events';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const url = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      this.logger.log('RabbitMQ connected');
      this.connection.on('error', (err) => this.logger.warn(`RabbitMQ connection error: ${err.message}`));
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — reconnecting in 5s');
        this.channel = undefined as any;
        this.connection = undefined as any;
        setTimeout(() => this.connect(), 5000);
      });
    } catch (error) {
      this.logger.warn(`RabbitMQ unavailable; retrying in 10s (${(error as Error).message})`);
      setTimeout(() => this.connect(), 10000);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`RabbitMQ unavailable — event dropped: ${routingKey}`);
      return;
    }

    this.channel.publish(this.exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      persistent: true,
    });
  }
}
