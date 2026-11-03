import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OmitSubjectDto {
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  /** Leave empty to omit the subject from every class in the window; otherwise just these classes. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[];

  @IsString()
  @IsNotEmpty()
  reason!: string;

  /** Also make this a school-wide rule: every exam window opened from now on starts without the subject. */
  @IsOptional()
  @IsBoolean()
  applyToAllWindows?: boolean;

  /** Confirm that marks teachers already entered for the omitted sheets may be deleted. */
  @IsOptional()
  @IsBoolean()
  discardMarks?: boolean;
}
