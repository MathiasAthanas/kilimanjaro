import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { EducationStageDto } from '../../grading/dto/create-grading-scale.dto';

export enum ExamWindowScopeTypeDto {
  ALL_CLASSES = 'ALL_CLASSES',
  STANDARDS = 'STANDARDS',
  STREAMS = 'STREAMS',
}

export class CreateExamWindowDto {
  @IsString()
  @IsNotEmpty()
  examTypeId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsEnum(ExamWindowScopeTypeDto)
  scopeType!: ExamWindowScopeTypeDto;

  /** Required when scopeType = STANDARDS. Class levels, e.g. [6] for all Class 6 streams. */
  @ValidateIf((o) => o.scopeType === ExamWindowScopeTypeDto.STANDARDS)
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  scopeLevels?: number[];

  /** Required when scopeType = STREAMS. Explicit class ids. */
  @ValidateIf((o) => o.scopeType === ExamWindowScopeTypeDto.STREAMS)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  scopeClassIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  countsToReportCard?: boolean;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  /**
   * When true, immediately fan out the assessments and set the window OPEN so
   * teachers can start entering marks. When false the window stays DRAFT.
   */
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;
}

export class UpdateExamWindowDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  countsToReportCard?: boolean;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;
}

export class ExamWindowFilterDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsOptional()
  @IsString()
  examTypeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
