import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '../../../generated/prisma';

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
