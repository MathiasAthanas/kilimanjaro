import { IsString } from 'class-validator';

export class CreatePairingDto {
  @IsString()
  studentId!: string;

  @IsString()
  peerId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  subjectName!: string;

  @IsString()
  termId!: string;

  @IsString()
  reason!: string;
}