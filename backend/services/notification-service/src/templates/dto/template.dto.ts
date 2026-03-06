import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  smsBody?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewTemplateDto {
  @IsString()
  templateId!: string;

  @IsObject()
  sampleVariables!: Record<string, unknown>;
}

export class TemplateQueryDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsString()
  isActive?: string;
}
