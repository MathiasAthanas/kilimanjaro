import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { AccessControlService } from '../common/helpers/access-control.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, AccessControlService],
  exports: [StudentsService, AccessControlService],
})
export class StudentsModule {}