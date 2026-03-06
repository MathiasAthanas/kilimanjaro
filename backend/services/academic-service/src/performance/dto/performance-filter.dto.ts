import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class PerformanceFilterDto {
  @IsOptional()
  @IsString()
  alertType?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsBooleanString()
  isResolved?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}
