import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class ListStudentsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  search?: string;
}