import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Class, subject, academic year, and school are fixed at assignment time.
 * A reassignment may only change the teaching account, workload, or status.
 */
export class UpdateClassSubjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  teacherId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodsPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
