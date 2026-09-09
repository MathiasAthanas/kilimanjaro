import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WindowSelectionDto {
  @IsString()
  @IsNotEmpty()
  examWindowId!: string;

  /** Overrides the window's own weight for this composition. Defaults to the window weight. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;
}

export class ComposeReportCardsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  /** Narrow to a single standard level (e.g. 6). Omit to cover every class the windows touch. */
  @IsOptional()
  @IsInt()
  scopeLevel?: number;

  /** Narrow to explicit classes. Omit to cover every class the windows touch. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopeClassIds?: string[];

  /** The windows (1..N) to blend, each with an optional weight. */
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WindowSelectionDto)
  windows!: WindowSelectionDto[];

  /** Publish the generated report cards immediately (students/parents can see them). */
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
