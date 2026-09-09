import { IsOptional, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateEditRequestDto {
  @IsString()
  @IsNotEmpty()
  examWindowId!: string;

  /** The specific assessment (subject × class) the teacher wants to edit. */
  @IsOptional()
  @IsString()
  assessmentId?: string;

  @IsString()
  @MinLength(5)
  reason!: string;
}

export class DecideEditRequestDto {
  @IsOptional()
  @IsString()
  note?: string;
}
