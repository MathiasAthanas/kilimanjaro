import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { GuardianRelationship } from '@prisma/client';

export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationship?: GuardianRelationship;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}