import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssetDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsString() @IsNotEmpty() type!: string;
  @IsString() @IsNotEmpty() condition!: string;
  @IsString() @IsNotEmpty() status!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() purchaseCost?: string;
  @IsOptional() @IsString() currentValue?: string;
}
