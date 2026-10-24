import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentImportService } from './import/student-import.service';
import { AuthClientService } from '../admissions/auth-client.service';
import { AccessControlService } from '../common/helpers/access-control.service';
import { StudentLifecycleService } from './student-lifecycle.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, StudentImportService, AuthClientService, AccessControlService, StudentLifecycleService],
  exports: [StudentsService, AccessControlService],
})
export class StudentsModule {}
