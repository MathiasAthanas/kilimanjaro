import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BulkAssignFeeDto {
  @IsArray()
  studentIds!: string[];

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
