import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum EducationStageDto {
  NURSERY = 'NURSERY',
  PRE_UNIT = 'PRE_UNIT',
  PRIMARY = 'PRIMARY',
  O_LEVEL = 'O_LEVEL',
  A_LEVEL = 'A_LEVEL',
}

export class CreateClassDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  level!: number;

  @IsOptional()
  @IsString()
  stream?: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsOptional()
  @IsString()
  curriculumCode?: string;

  /** A-Level subject combination attached to this class (e.g. HGE, PCB). */
  @IsOptional()
  @IsString()
  combinationCode?: string;

  @IsOptional()
  @IsString()
  combinationId?: string;

  @IsOptional()
  @IsBoolean()
  terminalYear?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
