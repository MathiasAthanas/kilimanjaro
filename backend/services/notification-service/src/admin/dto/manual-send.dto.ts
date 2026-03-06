import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class ManualSendDto {
  @IsArray()
  recipientIds!: string[];

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;
}
