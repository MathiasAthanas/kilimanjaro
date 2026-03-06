import { IsOptional, IsString } from 'class-validator';

export class ApproveAssessmentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
