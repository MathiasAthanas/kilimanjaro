import { Module } from '@nestjs/common';
import { GradingResolverService } from './grading-resolver.service';

/** Shared module so every service (exams, report cards, legacy results) grades through ONE resolver. */
@Module({
  providers: [GradingResolverService],
  exports: [GradingResolverService],
})
export class GradingResolverModule {}
