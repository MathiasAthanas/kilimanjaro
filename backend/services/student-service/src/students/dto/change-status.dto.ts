import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(StudentStatus)
  status!: StudentStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  transferSchool?: string;
}