import { IsString } from 'class-validator';

export class PromoteStudentDto {
  @IsString()
  toClassId!: string;

  @IsString()
  academicYearId!: string;
}