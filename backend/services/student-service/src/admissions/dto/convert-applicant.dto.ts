import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ResidenceType } from '../../../generated/prisma';

export class ConvertApplicantDto {
  /** Defaults to today when omitted */
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  /** Confirms or overrides the applicant's residence choice at enrolment. */
  @IsOptional()
  @IsEnum(ResidenceType)
  residenceType?: ResidenceType;
}
