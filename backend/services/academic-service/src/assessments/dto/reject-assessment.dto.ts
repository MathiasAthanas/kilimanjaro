import { IsNotEmpty, IsString } from 'class-validator';

export class RejectAssessmentDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
