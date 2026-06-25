import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [DepartmentsModule],
  controllers: [InternalController],
})
export class InternalModule {}