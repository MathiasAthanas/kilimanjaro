import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateStudentSubjectEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  classId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsOptional()
  @IsString()
  combinationId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
