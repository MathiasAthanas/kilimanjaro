import {
  Body,
  Controller,
  Delete,
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

@ApiTags('Users')
@ApiBearerAuth()
@Controller('auth/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: { sub: string }) {
    return this.usersService.createUser(dto, user.sub);
  }

  @Patch(':userId/deactivate')
  async deactivate(@Param('userId') userId: string, @CurrentUser() user: { sub: string }) {
    await this.usersService.deactivateUser(userId, user.sub);
    return { message: 'User deactivated' };
  }

  @Patch(':userId/activate')
  async activate(@Param('userId') userId: string, @CurrentUser() user: { sub: string }) {
    await this.usersService.activateUser(userId, user.sub);
    return { message: 'User activated' };
  }

  @Patch(':userId/role')
  async updateRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: { sub: string },
  ) {
    await this.usersService.updateRole(userId, dto.role, user.sub);
    return { message: 'User role updated' };
  }

  @Patch(':userId/unlock')
  async unlock(@Param('userId') userId: string, @CurrentUser() user: { sub: string }) {
    await this.usersService.unlockUser(userId, user.sub);
    return { message: 'User unlocked' };
  }

  @Patch(':userId')
  async update(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.updateUser(userId, dto, user.sub);
  }

  @Post(':userId/reset-password')
  async resetPassword(
    @Param('userId') userId: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.resetPassword(userId, dto, user.sub);
  }

  @Post(':userId/invite')
  async invite(@Param('userId') userId: string, @CurrentUser() user: { sub: string }) {
    return this.usersService.inviteUser(userId, user.sub);
  }

  @Get(':userId/sessions')
  async sessions(@Param('userId') userId: string) {
    return this.usersService.listSessions(userId);
  }

  @Delete(':userId/sessions/:sessionId')
  async revokeSession(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.revokeSession(userId, sessionId, user.sub);
  }

  @Delete(':userId/sessions')
  async revokeAllSessions(@Param('userId') userId: string, @CurrentUser() user: { sub: string }) {
    return this.usersService.revokeAllSessions(userId, user.sub);
  }

  @Get()
  @Roles(Role.SYSTEM_ADMIN, Role.PRINCIPAL, Role.ACADEMIC_QA, Role.HEAD_OF_DEPARTMENT)
  async list(@Query() query: ListUsersDto) {
    return this.usersService.listUsers(query);
  }
}
