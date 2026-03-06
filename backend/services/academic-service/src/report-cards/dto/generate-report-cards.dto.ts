import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateReportCardsDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;
}
