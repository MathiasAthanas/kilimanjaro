import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RabbitMqConsumer } from './rabbitmq.consumer';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [RabbitMqConsumer],
})
export class RabbitMqModule {}
