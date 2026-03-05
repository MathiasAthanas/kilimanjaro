import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { GuardianRelationship } from '@prisma/client';

export class CreateGuardianDto {
  @IsOptional()
  @IsString()
  authUserId?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @IsString()
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}