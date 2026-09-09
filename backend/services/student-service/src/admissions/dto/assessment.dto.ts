import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AdmissionAssessmentOutcome } from '../../../generated/prisma';

export class ScheduleAssessmentDto {
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  subjectFocus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordAssessmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsEnum(AdmissionAssessmentOutcome)
  outcome?: AdmissionAssessmentOutcome;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
