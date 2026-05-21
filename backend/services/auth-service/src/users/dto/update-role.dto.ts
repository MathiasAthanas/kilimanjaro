import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}
