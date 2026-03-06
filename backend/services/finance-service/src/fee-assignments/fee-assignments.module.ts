import { Module } from '@nestjs/common';
import { FeeAssignmentsController } from './fee-assignments.controller';
import { FeeAssignmentsService } from './fee-assignments.service';

@Module({
  controllers: [FeeAssignmentsController],
  providers: [FeeAssignmentsService],
  exports: [FeeAssignmentsService],
})
export class FeeAssignmentsModule {}
