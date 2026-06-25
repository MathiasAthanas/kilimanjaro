import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AssignHodDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  academicYearId!: string;
}
