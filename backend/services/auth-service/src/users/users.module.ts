import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersInternalController } from './users-internal.controller';

@Module({
  imports: [PrismaModule, AuditModule, RabbitMqModule],
  providers: [UsersService],
  controllers: [UsersController, UsersInternalController],
  exports: [UsersService],
})
export class UsersModule {}
