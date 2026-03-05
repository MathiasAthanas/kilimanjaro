import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional()
  @ValidateIf((o: LoginDto) => !o.registrationNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}
