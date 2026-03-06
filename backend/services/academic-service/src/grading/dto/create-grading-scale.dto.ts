import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class GradeBoundaryDto {
  @IsString()
  @IsNotEmpty()
  grade!: string;

  @IsNumber()
  minScore!: number;

  @IsNumber()
  maxScore!: number;

  @IsNumber()
  points!: number;

  @IsString()
  @IsNotEmpty()
  remark!: string;

  @IsOptional()
  @IsBoolean()
  isPassing?: boolean;
}

export class CreateGradingScaleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeBoundaryDto)
  grades!: GradeBoundaryDto[];
}
