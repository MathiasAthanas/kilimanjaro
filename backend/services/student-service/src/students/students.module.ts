import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentImportService } from './import/student-import.service';
import { AuthClientService } from '../admissions/auth-client.service';
import { AccessControlService } from '../common/helpers/access-control.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, StudentImportService, AuthClientService, AccessControlService],
  exports: [StudentsService, AccessControlService],
})
export class StudentsModule {}
