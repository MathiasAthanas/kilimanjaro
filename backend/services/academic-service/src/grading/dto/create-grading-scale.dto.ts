import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum EducationStageDto {
  PRIMARY = 'PRIMARY',
  O_LEVEL = 'O_LEVEL',
  A_LEVEL = 'A_LEVEL',
}

class GradeBoundaryDto {
  @IsString()
  @IsNotEmpty()
  grade!: string;

  @IsNumber()
  minScore!: number;

  @IsNumber()
  maxScore!: number;

  @IsNumber()
  points!: number;

  @IsString()
  @IsNotEmpty()
  remark!: string;

  @IsOptional()
  @IsBoolean()
  isPassing?: boolean;
}

export class CreateGradingScaleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeBoundaryDto)
  grades!: GradeBoundaryDto[];
}
