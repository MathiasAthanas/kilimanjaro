import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTermDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}