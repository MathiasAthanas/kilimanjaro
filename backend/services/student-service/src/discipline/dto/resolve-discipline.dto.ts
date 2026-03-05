import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ResolveDisciplineDto {
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}