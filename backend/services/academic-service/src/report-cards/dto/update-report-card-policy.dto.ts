import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateReportCardPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  primaryPassMark?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oLevelPassMark?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  aLevelPassMark?: number;

  @IsOptional()
  @IsBoolean()
  showSubjectSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  hideExemptSubjects?: boolean;

  @IsOptional()
  @IsBoolean()
  autoAlternativeSubjectExemptions?: boolean;
}
