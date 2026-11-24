import { ReportType } from '../../generated/prisma';
import { IsEnum, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class GenerateReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsString()
  scope!: string;

  @IsOptional()
  @IsString()
  scopeId?: string;

  /** Multi-school: scope a report to a single school. Omit for a group-wide report. */
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  termId?: string;

  /** File format of the download. Defaults to PDF; report cards are PDF only. */
  @IsOptional()
  @IsIn(['PDF', 'XLSX', 'CSV'])
  format?: 'PDF' | 'XLSX' | 'CSV';

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
