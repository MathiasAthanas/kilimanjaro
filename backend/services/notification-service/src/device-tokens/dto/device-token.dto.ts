import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class UpsertDeviceTokenDto {
  @IsString()
  token!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
