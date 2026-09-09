import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MembershipsService } from './memberships.service';

export class AssignMembershipDto {
  @IsString()
  @IsNotEmpty()
  authUserId!: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsEnum(Role)
  role!: Role;
}

export class AssignWithUserDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class AppointHeadOfFinanceDto {
  @IsString()
  @IsNotEmpty()
  authUserId!: string;
}

type MembershipActor = {
  sub: string;
  role: string;
  scope?: 'GROUP' | 'SCHOOL';
  schoolIds?: string[];
  activeSchoolId?: string;
};

@ApiTags('School Memberships')
@ApiBearerAuth()
@Controller('auth/memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SYSTEM_ADMIN)
  assign(@Body() dto: AssignMembershipDto, @CurrentUser() user: MembershipActor) {
    return this.membershipsService.assign(dto, user.sub, user.role, user);
  }

  @Post('with-user')
  @Roles(Role.SUPER_ADMIN, Role.SYSTEM_ADMIN)
  assignWithUser(@Body() dto: AssignWithUserDto, @CurrentUser() user: MembershipActor) {
    return this.membershipsService.assignWithUser(dto, user.sub, user.role, user);
  }

  @Post('head-of-finance')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  appointHeadOfFinance(@Body() dto: AppointHeadOfFinanceDto, @CurrentUser() user: { sub: string }) {
    return this.membershipsService.appointHeadOfFinance(dto.authUserId, user.sub);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.SYSTEM_ADMIN)
  revoke(@Param('id') id: string, @CurrentUser() user: MembershipActor) {
    return this.membershipsService.revoke(id, user.sub, user.role, user);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SYSTEM_ADMIN, Role.MANAGER, Role.HEAD_OF_SCHOOL, Role.HEAD_OF_FINANCE)
  list(
    @Query('schoolId') schoolId?: string,
    @Query('role') role?: Role,
    @Query('authUserId') authUserId?: string,
    @CurrentUser() user?: MembershipActor,
  ) {
    return this.membershipsService.list({ schoolId, role, authUserId }, user?.role, user);
  }
}
