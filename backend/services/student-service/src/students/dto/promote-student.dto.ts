import { IsOptional, IsString } from 'class-validator';

export class PromoteStudentDto {
  @IsOptional()
  @IsString()
  toClassId?: string;

  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  fromClassId?: string;
}
