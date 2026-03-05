import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Channel, ConsumeMessage } from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from './rabbitmq.service';
import { PerformanceEngineService } from '../performance/performance-engine.service';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly rabbitMq: RabbitMqService,
    private readonly engine: PerformanceEngineService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = await this.rabbitMq.createConsumerChannel();
    if (!channel) {
      return;
    }

    await channel.assertExchange('academic.events', 'topic', { durable: true });
    await channel.assertExchange('auth.events', 'topic', { durable: true });

    const academicQueue = 'student-service.academic';
    await channel.assertQueue(academicQueue, { durable: true });
    await channel.bindQueue(academicQueue, 'academic.events', 'performance.snapshot.ready');
    await channel.bindQueue(academicQueue, 'academic.events', 'results.published');

    const authQueue = 'student-service.auth';
    await channel.assertQueue(authQueue, { durable: true });
    await channel.bindQueue(authQueue, 'auth.events', 'user.created');

    await channel.consume(academicQueue, async (message) => this.handleMessage(channel, message));
    await channel.consume(authQueue, async (message) => this.handleMessage(channel, message));
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
      } else if (routingKey === 'results.published') {
        await this.engine.attendanceCorrelationCheck();
      } else if (routingKey === 'user.created') {
        await this.handleUserCreated(payload);
      }

      channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to process event ${routingKey}`, error as Error);
      channel.ack(message);
    }
  }

  private async handleUserCreated(payload: {
    userId?: string;
    role?: string;
    registrationNumber?: string;
    phoneNumber?: string;
  }): Promise<void> {
    if (!payload.userId || !payload.role) {
      return;
    }

    if (payload.role === 'STUDENT' && payload.registrationNumber) {
      await this.prisma.student.updateMany({
        where: {
          registrationNumber: payload.registrationNumber,
          authUserId: {
            not: payload.userId,
          },
        },
        data: {
          authUserId: payload.userId,
        },
      });
    }

    if (payload.role === 'PARENT' && payload.phoneNumber) {
      await this.prisma.guardian.updateMany({
        where: {
          phoneNumber: payload.phoneNumber,
          authUserId: {
            not: payload.userId,
          },
        },
        data: {
          authUserId: payload.userId,
        },
      });
    }
  }
}