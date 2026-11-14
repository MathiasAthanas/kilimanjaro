import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentClientService } from '../../student-client/student-client.service';

/** INV + last two digits of the year + the counter padded to five digits (grows past 99,999 rather than repeating). */
export function formatInvoiceNumber(year: number, value: number): string {
  return `INV${String(year % 100).padStart(2, '0')}${String(value).padStart(5, '0')}`;
}

@Injectable()
export class NumberSequenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentClientService,
  ) {}

  /**
   * Every document number is unique across the whole group, while each school counts from 1.
   * So numbers carry the school code: PAY-KS-PRI-2026-00000001. Group-level records keep the plain form.
   */
  private async tag(schoolId?: string | null): Promise<string> {
    if (!schoolId) return '';
    const code = await this.students.schoolCode(schoolId);
    // An unknown school still must not collide with another one: fall back to a slice of its id.
    return `${(code ?? schoolId.slice(-6)).toUpperCase()}-`;
  }

  // Single atomic INSERT ... ON CONFLICT DO UPDATE guarantees no duplicate values
  // under concurrent load — no SELECT + UPDATE race condition is possible.
  // schoolId scopes sequences per school so each school gets its own 1-based counter.
  private async next(prefix: string, year: number, schoolId?: string | null): Promise<number> {
    const scopePart = schoolId ? `:${schoolId}` : ':group';
    const id = `${prefix}${scopePart}:${year}`;
    const rows = await this.prisma.$queryRaw<{ value: number }[]>`
      INSERT INTO finance."NumberSequence" (id, year, value, "updatedAt")
      VALUES (${id}, ${year}, 1, now())
      ON CONFLICT (id)
      DO UPDATE SET value = finance."NumberSequence".value + 1, "updatedAt" = now()
      RETURNING value
    `;
    return Number(rows[0].value);
  }

  /**
   * Parents type this number into mobile-money and bank prompts, so it is short: INV + two-digit year + five digits
   * (INV2600123, 10 characters). One counter for the whole group keeps every number unique without a school or term
   * code; the school and term are already on the invoice itself.
   */
  async invoiceNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('INVS', year, null);
    return formatInvoiceNumber(year, value);
  }

  async paymentNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('PAY', year, schoolId);
    return `PAY-${await this.tag(schoolId)}${year}-${String(value).padStart(8, '0')}`;
  }

  async receiptNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('RCP', year, schoolId);
    return `RCP-${await this.tag(schoolId)}${year}-${String(value).padStart(8, '0')}`;
  }

  async assetNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('AST', year, schoolId);
    return `AST-${await this.tag(schoolId)}${year}-${String(value).padStart(5, '0')}`;
  }

  async expenseNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('EXP', year, schoolId);
    return `EXP-${await this.tag(schoolId)}${year}-${String(value).padStart(5, '0')}`;
  }

  async fundRequestNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('FRQ', year, schoolId);
    return `FRQ-${await this.tag(schoolId)}${year}-${String(value).padStart(5, '0')}`;
  }

  async storeItemCode(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('STK', year, schoolId);
    return `STK-${await this.tag(schoolId)}${year}-${String(value).padStart(5, '0')}`;
  }

  async storeMovementNumber(schoolId?: string | null): Promise<string> {
    const year = new Date().getUTCFullYear();
    const value = await this.next('SMV', year, schoolId);
    return `SMV-${await this.tag(schoolId)}${year}-${String(value).padStart(6, '0')}`;
  }
}
