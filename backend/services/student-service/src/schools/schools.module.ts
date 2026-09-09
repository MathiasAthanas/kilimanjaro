import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [PrismaModule, RabbitMqModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
