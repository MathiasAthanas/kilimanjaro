import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

/** One raw row from a class list (legacy Excel/CSV or normalized upload). */
export class ImportStudentRowDto {
  /** Full name — split into first/middle/last by the importer. */
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  stream?: string;

  @IsOptional()
  @IsString()
  contacts?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}

export class ImportStudentsDto {
  /** Target class — determines school, year, stage, stream and combination. */
  @IsString()
  classId!: string;

  /** Optional override; defaults to the class academic year. */
  @IsOptional()
  @IsString()
  academicYearId?: string;

  /** false (default) = validate and return a preview; true = create students. */
  @IsOptional()
  @IsBoolean()
  commit?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStudentRowDto)
  rows!: ImportStudentRowDto[];
}
