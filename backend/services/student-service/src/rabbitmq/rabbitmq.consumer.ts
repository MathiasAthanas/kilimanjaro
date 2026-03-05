import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
import { RabbitMqService } from './rabbitmq.service';
import { PerformanceEngineService } from '../performance/performance-engine.service';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqService,
    private readonly engine: PerformanceEngineService,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = await this.rabbitMq.createConsumerChannel();
    if (!channel) {
      return;
    }

    await channel.assertExchange('academic.events', 'topic', { durable: true });
    await channel.assertExchange('auth.events', 'topic', { durable: true });

    const queue = 'student.service.queue';
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, 'academic.events', 'performance.snapshot.ready');
    await channel.bindQueue(queue, 'auth.events', 'user.deleted');

    await channel.consume(queue, async (message) => this.handleMessage(channel, message));
  }

  private async handleMessage(channel: Channel, message: ConsumeMessage | null): Promise<void> {
    if (!message) {
      return;
    }

    const routingKey = message.fields.routingKey;

    try {
      const payload = JSON.parse(message.content.toString());

      if (routingKey === 'performance.snapshot.ready') {
        await this.engine.ingestSnapshot(payload);
      }

      channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to process event ${routingKey}`, error as Error);
      channel.ack(message);
    }
  }
}
