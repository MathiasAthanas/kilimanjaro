import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListUsersDto } from './dto/list-users.dto';

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

  @Get()
  async list(@Query() query: ListUsersDto) {
    return this.usersService.listUsers(query);
  }
}
