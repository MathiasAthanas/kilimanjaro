import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NumberSequenceService {
  constructor(private readonly prisma: PrismaService) {}

  // Single atomic INSERT ... ON CONFLICT DO UPDATE guarantees no duplicate values
  // under concurrent load — no SELECT + UPDATE race condition is possible.
  // schoolId scopes sequences per school so each school gets its own 1-based counter.
  private async next(prefix: string, year: number, schoolId?: string | null): Promise<number> {
    const scopePart = schoolId ? `:${schoolId}` : ':group';
    const id = `${prefix}${scopePart}:${year}`;
    const rows = await this.prisma.$queryRaw<{ value: number }[]>`
      INSERT INTO finance."NumberSequence" (id, year, value)
      VALUES (${id}, ${year}, 1)
      ON CONFLICT (id)
      DO UPDATE SET value = finance."NumberSequence".value + 1
      RETURNING value
    `;
    return Number(rows[0].value);
  }

  async invoiceNumber(termCode: string, schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('INV', year, schoolId);
    return `INV-${year}-${termCode}-${String(value).padStart(5, '0')}`;
  }

  async paymentNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('PAY', year, schoolId);
    return `PAY-${year}-${String(value).padStart(8, '0')}`;
  }

  async receiptNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('RCP', year, schoolId);
    return `RCP-${year}-${String(value).padStart(8, '0')}`;
  }

  async assetNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('AST', year, schoolId);
    return `AST-${year}-${String(value).padStart(5, '0')}`;
  }

  async expenseNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('EXP', year, schoolId);
    return `EXP-${year}-${String(value).padStart(5, '0')}`;
  }

  async fundRequestNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('FRQ', year, schoolId);
    return `FRQ-${year}-${String(value).padStart(5, '0')}`;
  }

  async storeItemCode(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('STK', year, schoolId);
    return `STK-${year}-${String(value).padStart(5, '0')}`;
  }

  async storeMovementNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('SMV', year, schoolId);
    return `SMV-${year}-${String(value).padStart(6, '0')}`;
  }
}
