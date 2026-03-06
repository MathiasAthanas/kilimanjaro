import { IsIn, IsOptional, IsString } from 'class-validator';

export class RunEngineDto {
  @IsIn(['student', 'class', 'all'])
  scope!: 'student' | 'class' | 'all';

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}
