import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const CONTACT_STATUSES = ['CONTACTED', 'PROMISED', 'ESCALATED'] as const;
export const CONTACT_METHODS = ['PHONE', 'SMS', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'LETTER', 'OTHER'] as const;

export class CreateDefaulterContactDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsIn(CONTACT_METHODS as unknown as string[])
  method?: string;

  /** Where the follow-up stands after this contact (defaults to CONTACTED). */
  @IsOptional()
  @IsIn(CONTACT_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
