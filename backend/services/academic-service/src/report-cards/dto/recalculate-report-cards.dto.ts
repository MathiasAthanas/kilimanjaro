import { IsUUID } from 'class-validator';

export class RecalculateReportCardsDto {
  @IsUUID()
  termId!: string;
}
