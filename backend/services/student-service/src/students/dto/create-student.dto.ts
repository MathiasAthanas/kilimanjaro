import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Gender, GuardianRelationship } from '@prisma/client';

export class CreateStudentGuardianDto {
  @IsOptional()
  @IsString()
  authUserId?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @IsString()
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  isPrimary?: boolean;
}

export class CreateStudentDto {
  @IsString()
  authUserId!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsDateString()
  admissionDate!: string;

  @IsString()
  classId!: string;

  @IsString()
  academicYearId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentGuardianDto)
  guardians!: CreateStudentGuardianDto[];
}