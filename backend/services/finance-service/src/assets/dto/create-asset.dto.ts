import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const ASSET_CATEGORIES = ['FURNITURE', 'ELECTRONICS', 'VEHICLE', 'BUILDING', 'EQUIPMENT', 'LABORATORY', 'LIBRARY', 'SPORTS', 'OTHER'] as const;
export const ASSET_TYPES = ['FIXED', 'MOVABLE'] as const;
export const ASSET_CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CONDEMNED'] as const;
export const ASSET_STATUSES = ['ACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST', 'STOLEN'] as const;

export class CreateAssetDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsIn(ASSET_CATEGORIES) category!: (typeof ASSET_CATEGORIES)[number];
  @IsIn(ASSET_TYPES) type!: (typeof ASSET_TYPES)[number];
  @IsOptional() @IsIn(ASSET_CONDITIONS) condition?: (typeof ASSET_CONDITIONS)[number];
  @IsOptional() @IsIn(ASSET_STATUSES) status?: (typeof ASSET_STATUSES)[number];
  @IsOptional() @IsString() description?: string;
  @IsOptional() isGroup?: boolean;
  @IsOptional() @IsString() groupType?: string;
  @IsOptional() @IsString() parentAssetId?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() purchaseDate?: string;
  @IsOptional() @IsString() warrantyExpiry?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() quantity?: string;
  @IsOptional() @IsString() unitCost?: string;
  @IsOptional() @IsString() purchaseCost?: string;
  @IsOptional() @IsString() currentValue?: string;
}
