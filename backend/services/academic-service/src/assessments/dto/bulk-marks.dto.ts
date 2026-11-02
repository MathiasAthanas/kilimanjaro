import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class MarkEntryDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  /** Student was required to sit but did not. Scores 0 and counts in the average. */
  @IsOptional()
  @IsBoolean()
  notSat?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkMarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  marks!: MarkEntryDto[];
}
