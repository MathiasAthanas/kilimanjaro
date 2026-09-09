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

  // Optional: a cash payment recorded at the counter defaults to "now".
  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  supportingDocumentUrl?: string;
}
