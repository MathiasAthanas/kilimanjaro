import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RabbitMqConsumer } from './rabbitmq.consumer';
import { RabbitMqService } from './rabbitmq.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [RabbitMqService, RabbitMqConsumer],
  exports: [RabbitMqService],
})
export class RabbitMqModule {}
