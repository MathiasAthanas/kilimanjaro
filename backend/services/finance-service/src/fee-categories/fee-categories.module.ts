import { Module } from '@nestjs/common';
import { FeeCategoriesController } from './fee-categories.controller';
import { FeeCategoriesService } from './fee-categories.service';

@Module({
  controllers: [FeeCategoriesController],
  providers: [FeeCategoriesService],
  exports: [FeeCategoriesService],
})
export class FeeCategoriesModule {}
