import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InterventionType } from '../../../generated/prisma';

export class CreateInterventionDto {
  @IsOptional()
  @IsString()
  alertId?: string;

  @IsOptional()
  @IsString()
  pairingId?: string;

  @IsString()
  @IsNotEmpty()
  studentId!: string;

  /** The school the student belongs to (needed when a teacher works in more than one school). */
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsString()
  @IsNotEmpty()
  type!: InterventionType;

  @IsString()
  @IsNotEmpty()
  note!: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
