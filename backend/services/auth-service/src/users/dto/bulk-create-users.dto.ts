import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class BulkUserRowDto extends CreateUserDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  rowNumber: number;
}
export class BulkCreateUsersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiProperty({ enum: ['VALIDATE_ONLY', 'COMMIT'] })
  @IsIn(['VALIDATE_ONLY', 'COMMIT'])
  mode: 'VALIDATE_ONLY' | 'COMMIT';

  @ApiProperty({ type: [BulkUserRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkUserRowDto)
  rows: BulkUserRowDto[];
}
