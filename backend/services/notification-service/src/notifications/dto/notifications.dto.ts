import { IsIn, IsOptional, IsString } from 'class-validator';

export class NotificationsQueryDto {
  @IsOptional()
  @IsString()
  isRead?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
