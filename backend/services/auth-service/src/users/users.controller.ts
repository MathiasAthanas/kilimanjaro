import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

type AuthenticatedUser = {
  sub: string;
  role: string;
  scope?: 'GROUP' | 'SCHOOL';
  schoolIds?: string[];
  activeSchoolId?: string;
};

class EnsureParentUserDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('auth/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SYSTEM_ADMIN, Role.ADMISSIONS)
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === Role.ADMISSIONS && dto.role !== Role.STUDENT && dto.role !== Role.PARENT) {
      throw new ForbiddenException('Admissions officers may only create STUDENT or PARENT accounts');
    }
    return this.usersService.createUser(dto, user.sub, user.role, user);
  }

  @Post('ensure-parent')
  @Roles(Role.SUPER_ADMIN, Role.SYSTEM_ADMIN, Role.ADMISSIONS)
  async ensureParent(@Body() dto: EnsureParentUserDto, @CurrentUser() user: AuthenticatedUser) {
    const schoolId = user.activeSchoolId ?? (user.scope === 'SCHOOL' && user.schoolIds?.length === 1 ? user.schoolIds[0] : null);
    if (!schoolId) {
      throw new ForbiddenException('Select a school before creating or linking a parent account');
    }
    return this.usersService.ensureParentAccount({ ...dto, schoolId }, user.sub);
  }

  @Patch(':userId/deactivate')
  async deactivate(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.usersService.deactivateUser(userId, user.sub, user.role, user);
    return { message: 'User deactivated' };
  }

  @Patch(':userId/activate')
  async activate(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.usersService.activateUser(userId, user.sub, user.role, user);
    return { message: 'User activated' };
  }

  @Patch(':userId/role')
  async updateRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.updateRole(userId, dto.role, user.sub, user.role, user);
    return { message: 'User role updated' };
  }

  @Patch(':userId/unlock')
  async unlock(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.usersService.unlockUser(userId, user.sub, user.role, user);
    return { message: 'User unlocked' };
  }

  @Patch(':userId')
  @Roles(Role.SYSTEM_ADMIN, Role.ADMISSIONS)
  async update(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateUser(userId, dto, user.sub, user.role, user);
  }

  @Post(':userId/reset-password')
  async resetPassword(
    @Param('userId') userId: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.resetPassword(userId, dto, user.sub, user.role, user);
  }

  @Post(':userId/invite')
  async invite(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.inviteUser(userId, user.sub, user.role, user);
  }

  @Get(':userId/sessions')
  async sessions(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listSessions(userId, user.role, user);
  }

  @Delete(':userId/sessions/:sessionId')
  async revokeSession(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.revokeSession(userId, sessionId, user.sub, user.role, user);
  }

  @Delete(':userId/sessions')
  async revokeAllSessions(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.revokeAllSessions(userId, user.sub, user.role, user);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.PRINCIPAL, Role.ACADEMIC_QA, Role.HEAD_OF_DEPARTMENT, Role.ADMISSIONS)
  async list(@Query() query: ListUsersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listUsers(query, user);
  }

  @Get(':userId')
  async getOne(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findManageableById(userId, user.role, user);
  }
}
