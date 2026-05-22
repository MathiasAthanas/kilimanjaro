import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { EducationStageDto } from '../../grading/dto/create-grading-scale.dto';

export enum SubjectRoleDto {
  PRINCIPAL             = 'PRINCIPAL',
  SUBSIDIARY            = 'SUBSIDIARY',
  COMPULSORY_SUBSIDIARY = 'COMPULSORY_SUBSIDIARY',
}

export class CombinationSubjectDto {
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  /** @deprecated Use subjectRole instead. */
  @IsOptional()
  @IsBoolean()
  isPrincipal?: boolean;

  /**
   * Semantic role of this subject inside the combination.
   * COMPULSORY_SUBSIDIARY = General Studies / General Paper (mandatory for every ACSEE candidate).
   */
  @IsOptional()
  @IsEnum(SubjectRoleDto)
  subjectRole?: SubjectRoleDto;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class CreateSubjectCombinationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(EducationStageDto)
  educationStage?: EducationStageDto;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CombinationSubjectDto)
  subjects!: CombinationSubjectDto[];
}
