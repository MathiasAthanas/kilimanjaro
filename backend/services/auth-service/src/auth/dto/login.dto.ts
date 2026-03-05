import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ description: 'Email (all roles except students)' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Registration number (students only)' })
  @IsString()
  @IsOptional()
  regNumber?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
