import { IsOptional, IsBoolean, IsNumber, IsString } from 'class-validator';

export class UpdateMarkDto {
  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
