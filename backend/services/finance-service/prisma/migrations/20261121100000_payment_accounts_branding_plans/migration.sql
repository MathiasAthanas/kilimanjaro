-- Payment accounts, school invoice branding / residence policy, payment plans and invoice instalments (all additive).
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_ACCOUNT_CREATED';
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_ACCOUNT_UPDATED';
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_ACCOUNT_REMOVED';
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'FINANCE_SETTINGS_UPDATED';
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_PLAN_SAVED';
ALTER TYPE finance."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_PLAN_APPLIED';

DO $$ BEGIN
  CREATE TYPE finance."PaymentAccountType" AS ENUM ('BANK', 'MOBILE_MONEY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finance."PaymentAccount" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "type" finance."PaymentAccountType" NOT NULL DEFAULT 'BANK',
  "bankName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentAccount_schoolId_isActive_displayOrder_idx" ON finance."PaymentAccount"("schoolId", "isActive", "displayOrder");

CREATE TABLE IF NOT EXISTS finance."SchoolFinanceSettings" (
  "schoolId" TEXT NOT NULL,
  "accentColor" TEXT,
  "invoiceTitle" TEXT,
  "invoiceNote" TEXT,
  "logoFile" TEXT,
  "signatureFile" TEXT,
  "stampFile" TEXT,
  "signatoryName" TEXT,
  "residenceChangePolicy" TEXT NOT NULL DEFAULT 'ASK',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolFinanceSettings_pkey" PRIMARY KEY ("schoolId")
);

CREATE TABLE IF NOT EXISTS finance."PaymentPlanTemplate" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "residenceType" finance."ResidenceType",
  "educationStage" finance."EducationStage",
  "classLevel" INTEGER,
  "academicYearId" TEXT,
  "termId" TEXT,
  "coveredCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "otherItemsLabel" TEXT,
  "otherItemsDueDays" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentPlanTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentPlanTemplate_schoolId_isActive_idx" ON finance."PaymentPlanTemplate"("schoolId", "isActive");

CREATE TABLE IF NOT EXISTS finance."PaymentPlanInstallment" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "groupLabel" TEXT,
  "label" TEXT NOT NULL,
  "percent" DECIMAL(7,4),
  "fixedAmount" DECIMAL(12,2),
  "isRemainder" BOOLEAN NOT NULL DEFAULT false,
  "dueDate" TIMESTAMP(3),
  "dueDaysAfterIssue" INTEGER,
  CONSTRAINT "PaymentPlanInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentPlanInstallment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES finance."PaymentPlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentPlanInstallment_templateId_sequence_key" ON finance."PaymentPlanInstallment"("templateId", "sequence");

CREATE TABLE IF NOT EXISTS finance."InvoiceInstallment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "groupLabel" TEXT,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "templateId" TEXT,
  "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES finance."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceInstallment_invoiceId_sequence_key" ON finance."InvoiceInstallment"("invoiceId", "sequence");
CREATE INDEX IF NOT EXISTS "InvoiceInstallment_invoiceId_dueDate_idx" ON finance."InvoiceInstallment"("invoiceId", "dueDate");
