import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { WaiveInvoiceDto } from './dto/waive-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Finance - Invoices')
@Controller('finance/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  generate(@Body() dto: GenerateInvoicesDto, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.generate(dto, user!);
  }

  @Get()
  @Roles(
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.MANAGING_DIRECTOR,
    ROLES.BOARD_DIRECTOR,
  )
  list(@Query() query: any, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.list(query, user!);
  }

  @Get('jobs/:jobId')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  jobStatus(@Param('jobId') jobId: string) {
    return this.invoicesService.getJob(jobId);
  }

  @Get(':id')
  @Roles(
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  byId(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.byId(id, user!);
  }

  @Get('student/:studentId')
  @Roles(
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  byStudent(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.byStudent(studentId, user!);
  }

  @Patch(':id/discount')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  discount(@Param('id') id: string, @Body() dto: ApplyDiscountDto, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.applyDiscount(id, dto.discountAmount, dto.discountReason, user!);
  }

  @Patch(':id/cancel')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  cancel(@Param('id') id: string, @Body() dto: CancelInvoiceDto, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.cancel(id, dto.cancellationReason, user!);
  }

  @Patch(':id/waive')
  @Roles(ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  waive(@Param('id') id: string, @Body() dto: WaiveInvoiceDto, @CurrentUser() user?: RequestUser) {
    return this.invoicesService.waive(id, dto.waiverReason, user!);
  }

  @Get(':id/pdf')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.PARENT, ROLES.STUDENT)
  async pdf(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const file = await this.invoicesService.getPdfFile(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    createReadStream(file.fullPath).pipe(res);
  }

  @Post(':id/regenerate-pdf')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  regenerate(@Param('id') id: string) {
    return this.invoicesService.regeneratePdf(id);
  }
}
