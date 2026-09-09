import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module';
import { StudentsModule } from '../students/students.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { AuthClientService } from './auth-client.service';

@Module({
  imports: [PrismaModule, RabbitMqModule, StudentsModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService, AuthClientService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
