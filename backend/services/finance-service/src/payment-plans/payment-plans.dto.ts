import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PlanInstallmentDto {
  @IsOptional() @IsString() @MaxLength(40) groupLabel?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) label!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) @Max(100) percent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) fixedAmount?: number;
  @IsOptional() @IsBoolean() isRemainder?: boolean;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(730) dueDaysAfterIssue?: number;
}

export class SavePaymentPlanDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(['BOARDING', 'DAY_SCHOLAR']) residenceType?: 'BOARDING' | 'DAY_SCHOLAR' | null;
  @IsOptional() @IsString() educationStage?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) classLevel?: number | null;
  @IsOptional() @IsString() academicYearId?: string | null;
  @IsOptional() @IsString() termId?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) coveredCategoryIds?: string[];
  @IsOptional() @IsString() @MaxLength(60) otherItemsLabel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) otherItemsDueDays?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(24) @ValidateNested({ each: true }) @Type(() => PlanInstallmentDto) installments!: PlanInstallmentDto[];
}

export class PreviewPlanDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(24) @ValidateNested({ each: true }) @Type(() => PlanInstallmentDto) installments!: PlanInstallmentDto[];
  /** What the plan splits (for example the tuition fee) */
  @Type(() => Number) @IsNumber() @Min(0) amountToSplit!: number;
  /** Fees the plan does not split, printed as one "other items" row */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAmount?: number;
  @IsOptional() @IsString() @MaxLength(60) otherItemsLabel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) otherItemsDueDays?: number;
}

export class ApplyInvoicePlanDto {
  /** Leave empty to let the system pick the best matching plan for this invoice */
  @IsOptional() @IsString() templateId?: string;
}

export class CustomInstallmentDto {
  @IsOptional() @IsString() @MaxLength(40) groupLabel?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) label!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @Type(() => Number) @IsNumber() @Min(0) amount!: number;
  @IsDateString() dueDate!: string;
}

export class SetCustomPlanDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(24) @ValidateNested({ each: true }) @Type(() => CustomInstallmentDto) installments!: CustomInstallmentDto[];
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string;
}

export class BulkApplyPlansDto {
  @IsString() @IsNotEmpty() academicYearId!: string;
  @IsString() @IsNotEmpty() termId!: string;
  /** Force one plan for all of them; otherwise each invoice gets its best match */
  @IsOptional() @IsString() templateId?: string;
}
