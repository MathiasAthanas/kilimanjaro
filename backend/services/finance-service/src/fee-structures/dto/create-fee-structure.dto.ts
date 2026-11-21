import { IsEnum, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import { ResidenceType } from '../../../generated/prisma';

export enum EducationStageDto {
  PRIMARY = 'PRIMARY',
  O_LEVEL = 'O_LEVEL',
  A_LEVEL = 'A_LEVEL',
}

export class CreateFeeStructureDto {
  @IsString()
  @IsNotEmpty()
  feeCategoryId!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsOptional()
  @IsInt()
  classLevel?: number;

  @IsOptional()
  @IsString()
  studentGroup?: string;

  @IsOptional()
  @IsEnum(ResidenceType)
  residenceType?: ResidenceType;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;
}
