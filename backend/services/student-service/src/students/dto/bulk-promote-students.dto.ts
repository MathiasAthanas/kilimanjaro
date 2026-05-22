import { IsArray, IsOptional, IsString } from 'class-validator';

export class BulkPromoteStudentsDto {
  @IsString()
  fromClassId!: string;

  @IsString()
  academicYearId!: string;

  @IsString()
  targetAcademicYearId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}
