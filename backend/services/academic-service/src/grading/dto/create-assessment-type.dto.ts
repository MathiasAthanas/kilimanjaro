import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { EducationStageDto } from './create-grading-scale.dto';

export class CreateAssessmentTypeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  weightPercentage!: number;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsOptional()
  @IsInt()
  classLevel?: number;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
