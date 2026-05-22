import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ClassTransitionTypeDto {
  PROMOTION = 'PROMOTION',
  CROSS_STAGE = 'CROSS_STAGE',
  GRADUATION = 'GRADUATION',
  TRANSFER = 'TRANSFER',
}

export class CreateClassPathwayDto {
  @IsString()
  fromClassId!: string;

  @IsOptional()
  @IsString()
  toClassId?: string;

  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsEnum(ClassTransitionTypeDto)
  transitionType?: ClassTransitionTypeDto;

  @IsOptional()
  @IsString()
  note?: string;
}
