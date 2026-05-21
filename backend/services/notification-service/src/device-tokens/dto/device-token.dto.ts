import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DevicePlatform } from '../../../generated/prisma';

export class UpsertDeviceTokenDto {
  @IsString()
  token!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
