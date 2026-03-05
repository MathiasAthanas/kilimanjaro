import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DisciplineCategory, DisciplineSeverity } from '@prisma/client';

export class CreateDisciplineDto {
  @IsString()
  studentId!: string;

  @IsDateString()
  incidentDate!: string;

  @IsEnum(DisciplineCategory)
  category!: DisciplineCategory;

  @IsEnum(DisciplineSeverity)
  severity!: DisciplineSeverity;

  @IsString()
  description!: string;

  @IsString()
  actionTaken!: string;

  @IsOptional()
  @IsBoolean()
  requiresParentNotification?: boolean;
}