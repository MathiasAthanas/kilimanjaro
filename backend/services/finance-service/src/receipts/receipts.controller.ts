import { Body, Controller, Get, Param, Patch, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { VoidReceiptDto } from './dto/void-receipt.dto';
import { ReceiptsService } from './receipts.service';

@ApiTags('Finance - Receipts')
@Controller('finance/receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.PARENT, ROLES.STUDENT)
  list(@Query() query: any, @CurrentUser() user?: RequestUser) {
    return this.receiptsService.list(query, user!);
  }

  @Get(':id')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.PARENT, ROLES.STUDENT)
  byId(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.receiptsService.byId(id, user!);
  }

  @Get(':id/pdf')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.PARENT, ROLES.STUDENT)
  async pdf(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const file = await this.receiptsService.getPdfFile(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    createReadStream(file.fullPath).pipe(res);
  }

  @Patch(':id/void')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  void(@Param('id') id: string, @Body() dto: VoidReceiptDto, @CurrentUser() user?: RequestUser) {
    return this.receiptsService.void(id, dto.voidReason, user!);
  }
}
