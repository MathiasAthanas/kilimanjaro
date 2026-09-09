import { Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { AlertSeverity, AlertType, PairingStatus } from '../../../generated/prisma';

export class PerformanceFilterDto {
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  // Accepts a single severity ("HIGH") or a comma-separated list ("HIGH,CRITICAL").
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : value,
  )
  @IsEnum(AlertSeverity, { each: true })
  severity?: AlertSeverity | AlertSeverity[];

  @IsOptional()
  @IsString()
  classId?: string;

  // Comma-separated list of classIds — accepted alongside singular classId for UI convenience.
  @IsOptional()
  @IsString()
  classIds?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @Type(() => Boolean)
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
