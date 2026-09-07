import { Role } from '../../../generated/prisma';
import { IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ enum: Role, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  primaryRole?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolChangeReason?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string | null;
}
