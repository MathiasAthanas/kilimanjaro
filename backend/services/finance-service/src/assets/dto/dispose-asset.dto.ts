import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DisposeAssetDto {
  @IsString() @IsNotEmpty() disposalDate!: string;
  @IsString() @IsNotEmpty() disposalReason!: string;
  @IsOptional() @IsString() disposalValue?: string;
}
