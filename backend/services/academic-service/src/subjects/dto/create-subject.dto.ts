import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EducationStageDto } from '../../grading/dto/create-grading-scale.dto';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;
}
