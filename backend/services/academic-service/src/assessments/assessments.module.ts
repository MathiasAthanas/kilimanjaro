import { Module, forwardRef } from '@nestjs/common';
import { ResultsModule } from '../results/results.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({
  imports: [forwardRef(() => ResultsModule)],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentModule {}
