import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional()
  @ValidateIf((o: LoginDto) => !o.registrationNumber && !o.phoneNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: LoginDto) => !o.email && !o.phoneNumber)
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}
