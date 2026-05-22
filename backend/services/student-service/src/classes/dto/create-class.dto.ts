import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum EducationStageDto {
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
