import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import {
  AdjustStockDto,
  CreateStoreItemDto,
  IssueStockDto,
  ReceiveStockDto,
  UpdateStoreItemDto,
} from './dto/store.dto';
import { StoreService } from './store.service';

const VIEW_ROLES = [
  ROLES.FINANCE,
  ROLES.PRINCIPAL,
  ROLES.SYSTEM_ADMIN,
  ROLES.MANAGING_DIRECTOR,
  ROLES.BOARD_DIRECTOR,
];
const MANAGE_ROLES = [ROLES.FINANCE, ROLES.SYSTEM_ADMIN];

@ApiTags('Finance - Store')
@Controller('finance/store')
export class StoreController {
  constructor(private readonly service: StoreService) {}

  @Get('items')
  @Roles(...VIEW_ROLES)
  listItems(@Query() query: any) {
    return this.service.listItems(query);
  }

  @Post('items')
  @Roles(...MANAGE_ROLES)
  createItem(@Body() dto: CreateStoreItemDto, @CurrentUser() user?: RequestUser) {
    return this.service.createItem(dto, user!);
  }

  @Get('summary')
  @Roles(...VIEW_ROLES)
  summary() {
    return this.service.summary();
  }

  @Get('movements')
  @Roles(...VIEW_ROLES)
  movements(@Query() query: any) {
    return this.service.movements(query);
  }

  @Get('items/:id')
  @Roles(...VIEW_ROLES)
  itemById(@Param('id') id: string) {
    return this.service.itemById(id);
  }

  @Patch('items/:id')
  @Roles(...MANAGE_ROLES)
  updateItem(@Param('id') id: string, @Body() dto: UpdateStoreItemDto, @CurrentUser() user?: RequestUser) {
    return this.service.updateItem(id, dto, user!);
  }

  @Post('items/:id/receive')
  @Roles(...MANAGE_ROLES)
  receive(@Param('id') id: string, @Body() dto: ReceiveStockDto, @CurrentUser() user?: RequestUser) {
    return this.service.receive(id, dto, user!);
  }

  @Post('items/:id/issue')
  @Roles(...MANAGE_ROLES)
  issue(@Param('id') id: string, @Body() dto: IssueStockDto, @CurrentUser() user?: RequestUser) {
    return this.service.issue(id, dto, user!);
  }

  @Post('items/:id/adjust')
  @Roles(...MANAGE_ROLES)
  adjust(@Param('id') id: string, @Body() dto: AdjustStockDto, @CurrentUser() user?: RequestUser) {
    return this.service.adjust(id, dto, user!);
  }
}
