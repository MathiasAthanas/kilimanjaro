import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateInvoicesDto {
  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsOptional()
  @IsArray()
  classIds?: string[];
}
