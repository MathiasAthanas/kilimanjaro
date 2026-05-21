import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { StudentStatus } from '../../../generated/prisma';

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