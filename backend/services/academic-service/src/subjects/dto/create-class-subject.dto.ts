import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EducationStageDto } from '../../grading/dto/create-grading-scale.dto';

export class CreateClassSubjectDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  teacherId!: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsOptional()
  @IsInt()
  classLevel?: number;

  @IsOptional()
  @IsString()
  combinationId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
