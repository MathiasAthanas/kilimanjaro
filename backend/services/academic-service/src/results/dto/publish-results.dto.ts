import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishResultsDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
