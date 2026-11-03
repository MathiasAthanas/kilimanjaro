import { Module } from '@nestjs/common';
import { GradingResolverModule } from '../exams/grading-resolver.module';
import { TeacherWorkspaceController } from './teacher-workspace.controller';
import { TeacherWorkspaceService } from './teacher-workspace.service';

@Module({
  imports: [GradingResolverModule],
  controllers: [TeacherWorkspaceController],
  providers: [TeacherWorkspaceService],
})
export class TeacherModule {}
