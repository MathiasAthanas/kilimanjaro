import { IsNotEmpty, IsString } from 'class-validator';

export class PublishResultsDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;
}
