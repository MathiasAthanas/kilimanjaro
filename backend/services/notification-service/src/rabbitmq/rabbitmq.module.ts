import { Module } from '@nestjs/common';
import { DispatchModule } from '../dispatch/dispatch.module';
import { RabbitMqConsumer } from './rabbitmq.consumer';

@Module({
  imports: [DispatchModule],
  providers: [RabbitMqConsumer],
})
export class RabbitMqModule {}
