import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { AlertSeverity, AlertType, PairingStatus } from '@prisma/client';

export class PerformanceFilterDto {
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  isResolved?: boolean;

  @IsOptional()
  @IsEnum(PairingStatus)
  status?: PairingStatus;

  @IsOptional()
  @IsString()
  termId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}