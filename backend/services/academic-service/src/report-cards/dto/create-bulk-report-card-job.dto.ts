import { IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBulkReportCardJobDto {
  @IsIn(['CLASS', 'LEVEL'])
  scopeType!: 'CLASS' | 'LEVEL';

  @ValidateIf((value: CreateBulkReportCardJobDto) => value.scopeType === 'CLASS')
  @IsString()
  classId?: string;

  @ValidateIf((value: CreateBulkReportCardJobDto) => value.scopeType === 'LEVEL')
  @IsString()
  educationStage?: string;

  @ValidateIf((value: CreateBulkReportCardJobDto) => value.scopeType === 'LEVEL')
  @Type(() => Number)
  @IsInt()
  @Min(0)
  classLevel?: number;

  @IsString()
  termId!: string;

  @IsOptional()
  @IsString()
  examLabel?: string;

  @IsIn(['pdf', 'zip'])
  format!: 'pdf' | 'zip';
}
