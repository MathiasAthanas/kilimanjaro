import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const STORE_CATEGORIES = [
  'FOOD',
  'STATIONERY',
  'CLEANING',
  'MAINTENANCE',
  'MEDICAL',
  'UNIFORM',
  'LABORATORY',
  'SPORTS',
  'OTHER',
] as const;

export class CreateStoreItemDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsIn(STORE_CATEGORIES) category!: (typeof STORE_CATEGORIES)[number];
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() reorderLevel?: string;
  @IsOptional() @IsString() unitCost?: string;
  @IsOptional() @IsString() openingQuantity?: string;
  @IsOptional() @IsString() location?: string;
}

export class UpdateStoreItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(STORE_CATEGORIES) category?: (typeof STORE_CATEGORIES)[number];
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() reorderLevel?: string;
  @IsOptional() @IsString() unitCost?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() isActive?: boolean;
}

export class ReceiveStockDto {
  @IsString() @IsNotEmpty() quantity!: string;
  @IsOptional() @IsString() unitCost?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() occurredAt?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() actorName?: string;
}

export class IssueStockDto {
  @IsString() @IsNotEmpty() quantity!: string;
  @IsOptional() @IsString() issuedTo?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() occurredAt?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() actorName?: string;
}

export class AdjustStockDto {
  @IsString() @IsNotEmpty() newQuantity!: string;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() actorName?: string;
}
