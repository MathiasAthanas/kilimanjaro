import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateFeeStructureDto {
  @IsString()
  @IsNotEmpty()
  feeCategoryId!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  classLevel?: number;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;
}
