import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InterventionType } from '@prisma/client';

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
