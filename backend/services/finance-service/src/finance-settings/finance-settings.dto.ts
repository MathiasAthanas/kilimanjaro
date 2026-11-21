import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreatePaymentAccountDto {
  @IsIn(['BANK', 'MOBILE_MONEY', 'OTHER']) type!: 'BANK' | 'MOBILE_MONEY' | 'OTHER';
  @IsString() @IsNotEmpty() @MaxLength(80) bankName!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) accountName!: string;
  @IsString() @IsNotEmpty() @MaxLength(60) accountNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
}

export class UpdatePaymentAccountDto {
  @IsOptional() @IsIn(['BANK', 'MOBILE_MONEY', 'OTHER']) type?: 'BANK' | 'MOBILE_MONEY' | 'OTHER';
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) bankName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) accountName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateFinanceSettingsDto {
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Accent colour must look like #D59A1B' }) accentColor?: string;
  @IsOptional() @IsString() @MaxLength(40) invoiceTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) invoiceNote?: string;
  @IsOptional() @IsString() @MaxLength(80) signatoryName?: string;
  @IsOptional() @IsIn(['NEXT_TERM', 'THIS_TERM', 'ASK']) residenceChangePolicy?: 'NEXT_TERM' | 'THIS_TERM' | 'ASK';
}

export class UploadBrandingImageDto {
  /** data:image/png;base64,... or data:image/jpeg;base64,... */
  @IsString() @IsNotEmpty() dataUrl!: string;
}
