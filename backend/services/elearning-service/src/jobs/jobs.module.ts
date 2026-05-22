import { Module } from '@nestjs/common';
import { DueSoonJob } from './due-soon.job';
import { OverdueJob } from './overdue.job';
import { ProgressAggregatorJob } from './progress-aggregator.job';
import { QuizAutoCloseJob } from './quiz-auto-close.job';

@Module({
  providers: [DueSoonJob, OverdueJob, QuizAutoCloseJob, ProgressAggregatorJob],
})
export class JobsModule {}
