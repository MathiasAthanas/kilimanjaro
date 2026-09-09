import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * One row from a filled marks template. The client (dashboard) parses the
 * teacher's .xlsx/.csv into these rows and posts them; students are matched by
 * registration number (ADMNO) — the column teachers actually recognise — or by
 * studentId when the dashboard already has it.
 */
export class UploadMarkRowDto {
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  /**
   * Accepts number, numeric string, or empty — the tolerant upload handler
   * validates each value and reports bad rows individually, so we deliberately
   * do NOT let the global ValidationPipe reject the whole batch here.
   */
  @IsOptional()
  score?: number | string;

  @IsOptional()
  isAbsent?: boolean | string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Original 1-based row number in the sheet, echoed back in error reports. */
  @IsOptional()
  row?: number;
}

export class UploadMarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadMarkRowDto)
  rows!: UploadMarkRowDto[];

  /** Submit the assessment for approval if every enrolled student now has a mark. */
  @IsOptional()
  @IsBoolean()
  autoSubmit?: boolean;
}
