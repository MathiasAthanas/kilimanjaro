import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SchoolGender, SchoolType } from '../../generated/prisma';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsEnum(SchoolType)
  type!: SchoolType;

  @IsOptional()
  @IsEnum(SchoolGender)
  gender?: SchoolGender;

  @IsOptional()
  @IsString()
  motto?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(SchoolType)
  type?: SchoolType;

  @IsOptional()
  @IsEnum(SchoolGender)
  gender?: SchoolGender;

  /** Required true when narrowing gender while students of the excluded gender exist */
  @IsOptional()
  @IsBoolean()
  acknowledgeNarrowing?: boolean;

  @IsOptional()
  @IsString()
  motto?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class SetSchoolStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
