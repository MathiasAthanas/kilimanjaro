import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateManualPaymentDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsString()
  @IsNotEmpty()
  payerName!: string;

  @IsOptional()
  @IsString()
  payerPhone?: string;

  @IsString()
  @IsNotEmpty()
  paidAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  supportingDocumentUrl?: string;
}
