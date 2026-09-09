import { IsDateString, IsOptional } from 'class-validator';

export class ConvertApplicantDto {
  /** Defaults to today when omitted */
  @IsOptional()
  @IsDateString()
  admissionDate?: string;
}
