import { Module } from '@nestjs/common';
import { FeeAssignmentsController } from './fee-assignments.controller';
import { FeeAssignmentsService } from './fee-assignments.service';
import { StudentClientModule } from '../student-client/student-client.module';

@Module({
  controllers: [FeeAssignmentsController],
  imports: [StudentClientModule],
  providers: [FeeAssignmentsService],
  exports: [FeeAssignmentsService],
})
export class FeeAssignmentsModule {}
