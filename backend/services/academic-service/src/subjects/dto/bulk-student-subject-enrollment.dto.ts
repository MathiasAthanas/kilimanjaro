import { IsArray, IsOptional, IsString } from 'class-validator';

export class BulkStudentSubjectEnrollmentDto {
  @IsArray()
  @IsString({ each: true })
  studentIds!: string[];

  @IsString()
  classId!: string;

  @IsString()
  academicYearId!: string;

  @IsString()
  combinationId!: string;

  @IsOptional()
  @IsString()
  termId?: string;
}
