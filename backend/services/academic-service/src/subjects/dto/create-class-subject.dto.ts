import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsBoolean()
  isActive?: boolean;
}
