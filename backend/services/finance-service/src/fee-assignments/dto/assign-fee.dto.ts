import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignFeeDto {
  @IsString()
  @IsNotEmpty()
  feeCategoryId!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
