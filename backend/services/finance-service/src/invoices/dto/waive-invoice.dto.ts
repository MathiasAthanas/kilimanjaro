import { IsNotEmpty, IsString } from 'class-validator';

export class WaiveInvoiceDto {
  @IsString()
  @IsNotEmpty()
  waiverReason!: string;
}
