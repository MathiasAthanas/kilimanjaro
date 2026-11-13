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

  /** "yes"/true when the student was required to sit but did not (scores 0, counts in the average). */
  @IsOptional()
  notSat?: boolean | string;

  @IsOptional()
  @IsString()
  note?: string;

  /**
   * True when the teacher brought this student in from "Add students" (exempt or not
   * registered for the subject). The server re-checks they belong to the class.
   */
  @IsOptional()
  @IsBoolean()
  add?: boolean;

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
