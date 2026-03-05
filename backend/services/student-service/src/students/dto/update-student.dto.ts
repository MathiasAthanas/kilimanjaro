import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}