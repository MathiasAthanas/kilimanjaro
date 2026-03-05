import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateTokenDto {
  @ApiProperty()
  @IsString()
  token: string;
}
