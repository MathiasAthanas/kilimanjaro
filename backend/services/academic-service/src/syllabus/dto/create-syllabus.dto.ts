import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateSyllabusDto {
  @IsString()
  @IsNotEmpty()
  classSubjectId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsInt()
  @Min(1)
  totalTopics!: number;
}
