DO $$ BEGIN
  CREATE TYPE finance."ResidenceType" AS ENUM ('BOARDING', 'DAY_SCHOLAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_FEE_REVIEW_MARKED';
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_FEE_RECALCULATED';

ALTER TABLE finance."FeeStructure" ADD COLUMN IF NOT EXISTS "residenceType" finance."ResidenceType";
DROP INDEX IF EXISTS finance."FeeStructure_feeCategoryId_classId_termId_academicYearId_key";
CREATE INDEX IF NOT EXISTS "FeeStructure_residenceType_termId_academicYearId_idx"
  ON finance."FeeStructure"("residenceType", "termId", "academicYearId");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeStructure_target_key"
  ON finance."FeeStructure" (
    "schoolId",
    "feeCategoryId",
    "classId",
    "educationStage",
    "classLevel",
    "studentGroup",
    "residenceType",
    "academicYearId",
    "termId"
  ) NULLS NOT DISTINCT;

ALTER TABLE finance."Invoice"
  ADD COLUMN IF NOT EXISTS "residenceType" finance."ResidenceType",
  ADD COLUMN IF NOT EXISTS "feeReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "feeReviewReason" TEXT,
  ADD COLUMN IF NOT EXISTS "feeReviewMarkedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Invoice_feeReviewRequired_status_idx" ON finance."Invoice"("feeReviewRequired", "status");

CREATE TABLE IF NOT EXISTS finance."InvoiceFeeRecalculation" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousResidence" finance."ResidenceType",
  "proposedResidence" finance."ResidenceType",
  "previousSubtotal" DECIMAL(12,2) NOT NULL,
  "proposedSubtotal" DECIMAL(12,2) NOT NULL,
  "previousTotal" DECIMAL(12,2) NOT NULL,
  "proposedTotal" DECIMAL(12,2) NOT NULL,
  "paidAmount" DECIMAL(12,2) NOT NULL,
  "previousLines" JSONB NOT NULL,
  "proposedLines" JSONB NOT NULL,
  "performedById" TEXT NOT NULL,
  "performedByRole" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceFeeRecalculation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceFeeRecalculation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES finance."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceFeeRecalculation_invoiceId_idempotencyKey_key" ON finance."InvoiceFeeRecalculation"("invoiceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "InvoiceFeeRecalculation_invoiceId_createdAt_idx" ON finance."InvoiceFeeRecalculation"("invoiceId", "createdAt");
