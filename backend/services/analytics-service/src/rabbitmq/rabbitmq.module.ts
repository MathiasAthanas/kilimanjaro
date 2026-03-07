import { Module } from '@nestjs/common';
import { DownstreamModule } from '../downstream/downstream.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ReportsModule } from '../reports/reports.module';
import { RabbitMqConsumer } from './rabbitmq.consumer';

@Module({
  imports: [PrismaModule, RedisModule, ReportsModule, DownstreamModule],
  providers: [RabbitMqConsumer],
})
export class RabbitMqModule {}
