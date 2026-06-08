import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NumberSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  private async next(key: string, year: number): Promise<number> {
    const sequence = await this.prisma.numberSequence.upsert({
      where: { id: `${key}:${year}` },
      create: { id: `${key}:${year}`, year, value: 1 },
      update: { value: { increment: 1 } },
      select: { value: true },
    });

    return sequence.value;
  }

  async invoiceNumber(termCode: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('INV', year);
    return `INV-${year}-${termCode}-${String(value).padStart(5, '0')}`;
  }

  async paymentNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('PAY', year);
    return `PAY-${year}-${String(value).padStart(8, '0')}`;
  }

  async receiptNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('RCP', year);
    return `RCP-${year}-${String(value).padStart(8, '0')}`;
  }

  async assetNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('AST', year);
    return `AST-${year}-${String(value).padStart(5, '0')}`;
  }

  async expenseNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('EXP', year);
    return `EXP-${year}-${String(value).padStart(5, '0')}`;
  }

  async fundRequestNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('FRQ', year);
    return `FRQ-${year}-${String(value).padStart(5, '0')}`;
  }

  async storeItemCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('STK', year);
    return `STK-${year}-${String(value).padStart(5, '0')}`;
  }

  async storeMovementNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('SMV', year);
    return `SMV-${year}-${String(value).padStart(6, '0')}`;
  }
}
