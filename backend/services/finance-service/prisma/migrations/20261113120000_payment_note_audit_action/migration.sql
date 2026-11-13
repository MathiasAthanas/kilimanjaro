-- The Prisma schema already lists PAYMENT_NOTE_ADDED but no earlier migration added it to the database enum,
-- so adding a verification note to a payment failed with a 500. Additive and idempotent.
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_NOTE_ADDED';
