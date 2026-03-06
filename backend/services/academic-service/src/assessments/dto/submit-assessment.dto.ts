import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitAssessmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
