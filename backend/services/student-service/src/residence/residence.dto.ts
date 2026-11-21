import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ResidenceType } from '../../generated/prisma';

export class ChangeResidenceDto {
  @IsEnum(ResidenceType) residenceType!: ResidenceType;
  /** NOW applies immediately; NEXT_TERM schedules the change for the start of the next term. */
  @IsIn(['NOW', 'NEXT_TERM']) effective!: 'NOW' | 'NEXT_TERM';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class BulkClassifyDto {
  @IsEnum(ResidenceType) residenceType!: ResidenceType;
  /** Explicit students; only students with no classification yet are changed. */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) studentIds?: string[];
  /** Or every unclassified student of one class. */
  @IsOptional() @IsString() classId?: string;
}

export class ResidenceStudentsQueryDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsIn(['UNCLASSIFIED', 'BOARDING', 'DAY_SCHOLAR', 'ALL']) status?: 'UNCLASSIFIED' | 'BOARDING' | 'DAY_SCHOLAR' | 'ALL';
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}
