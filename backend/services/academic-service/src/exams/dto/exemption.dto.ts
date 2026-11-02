import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum ExemptionScopeDto {
  STUDENT = 'STUDENT',
  CLASS = 'CLASS',
}

export class CreateExemptionDto {
  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  /** Omit for an exemption covering the entire term. */
  @IsOptional()
  @IsString()
  examWindowId?: string;

  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsEnum(ExemptionScopeDto)
  scope!: ExemptionScopeDto;

  /** One or more students (STUDENT scope). Ignored for CLASS scope. */
  @ValidateIf((o) => o.scope === ExemptionScopeDto.STUDENT)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  studentIds?: string[];

  /** Required to create; optional for a preview. */
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokeExemptionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ExemptionFilterDto {
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsOptional() @IsString() examWindowId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() status?: string;
}
