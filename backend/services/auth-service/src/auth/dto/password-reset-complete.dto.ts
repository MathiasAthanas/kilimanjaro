import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class PasswordResetCompleteDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
