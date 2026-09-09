import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateAssetDto } from './dto/create-asset.dto';
import { DisposeAssetDto } from './dto/dispose-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetsService } from './assets.service';

@ApiTags('Finance - Assets')
@Controller('finance/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN)
  create(@Body() dto: CreateAssetDto, @CurrentUser() user?: RequestUser) {
    return this.assetsService.create(dto, user!);
  }

  @Get()
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  list(@Query() query: any, @CurrentUser() user?: RequestUser) {
    return this.assetsService.list(query, user);
  }

  @Get('summary')
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  summary(@CurrentUser() user?: RequestUser) {
    return this.assetsService.summary(user);
  }

  @Get('reports/fixed-asset-register')
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  fixedAssetRegister(@CurrentUser() user?: RequestUser) {
    return this.assetsService.fixedAssetRegister(user);
  }

  @Get(':id')
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR)
  byId(@Param('id') id: string) {
    return this.assetsService.byId(id);
  }

  @Patch(':id')
  @Roles(ROLES.FINANCE, ROLES.HEAD_OF_FINANCE, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user?: RequestUser) {
    return this.assetsService.update(id, dto, user!);
  }

  @Patch(':id/dispose')
  @Roles(ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN)
  dispose(@Param('id') id: string, @Body() dto: DisposeAssetDto, @CurrentUser() user?: RequestUser) {
    return this.assetsService.dispose(id, dto, user!);
  }
}
