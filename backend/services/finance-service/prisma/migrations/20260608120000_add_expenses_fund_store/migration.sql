-- CreateEnum
CREATE TYPE "finance"."ExpenseCategory" AS ENUM ('SALARY', 'UTILITIES', 'MAINTENANCE', 'SUPPLIES', 'TRANSPORT', 'FOOD', 'ACADEMIC', 'ADMINISTRATIVE', 'EXAMINATION', 'SPORTS', 'FUND_DISBURSEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "finance"."ExpenseStatus" AS ENUM ('RECORDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "finance"."FundRequestStatus" AS ENUM ('SUBMITTED', 'FORWARDED', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "finance"."FundRequestAction" AS ENUM ('SUBMITTED', 'FORWARDED', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "finance"."StoreCategory" AS ENUM ('FOOD', 'STATIONERY', 'CLEANING', 'MAINTENANCE', 'MEDICAL', 'UNIFORM', 'LABORATORY', 'SPORTS', 'OTHER');

-- CreateEnum
CREATE TYPE "finance"."StoreMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'EXPENSE_RECORDED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'EXPENSE_VOIDED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'FUND_REQUEST_SUBMITTED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'FUND_REQUEST_FORWARDED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'FUND_REQUEST_APPROVED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'FUND_REQUEST_REJECTED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'FUND_REQUEST_DISBURSED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'FUND_REQUEST_CANCELLED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'STORE_ITEM_CREATED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'STORE_ITEM_UPDATED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'STORE_STOCK_RECEIVED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'STORE_STOCK_ISSUED';
ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE 'STORE_STOCK_ADJUSTED';

-- CreateTable
CREATE TABLE "finance"."Expense" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "category" "finance"."ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "payee" TEXT,
    "paymentMethod" "finance"."PaymentMethod",
    "reference" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "department" TEXT,
    "status" "finance"."ExpenseStatus" NOT NULL DEFAULT 'RECORDED',
    "fundRequestId" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT,
    "recordedByRole" TEXT NOT NULL,
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."FundRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "finance"."ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "department" TEXT,
    "status" "finance"."FundRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT,
    "requestedByRole" TEXT NOT NULL,
    "neededBy" TIMESTAMP(3),
    "bursarId" TEXT,
    "bursarName" TEXT,
    "bursarNote" TEXT,
    "forwardedAt" TIMESTAMP(3),
    "principalId" TEXT,
    "principalName" TEXT,
    "principalNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectedByRole" TEXT,
    "disbursedById" TEXT,
    "disbursedByName" TEXT,
    "disbursementMethod" "finance"."PaymentMethod",
    "disbursementRef" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."FundRequestEvent" (
    "id" TEXT NOT NULL,
    "fundRequestId" TEXT NOT NULL,
    "action" "finance"."FundRequestAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."StoreItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "finance"."StoreCategory" NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "description" TEXT,
    "quantityOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."StoreMovement" (
    "id" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "type" "finance"."StoreMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "supplier" TEXT,
    "issuedTo" TEXT,
    "department" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT,
    "recordedByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "finance"."Expense"("expenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_fundRequestId_key" ON "finance"."Expense"("fundRequestId");

-- CreateIndex
CREATE INDEX "Expense_category_incurredAt_idx" ON "finance"."Expense"("category", "incurredAt");

-- CreateIndex
CREATE INDEX "Expense_incurredAt_idx" ON "finance"."Expense"("incurredAt");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "finance"."Expense"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FundRequest_requestNumber_key" ON "finance"."FundRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FundRequest_expenseId_key" ON "finance"."FundRequest"("expenseId");

-- CreateIndex
CREATE INDEX "FundRequest_status_idx" ON "finance"."FundRequest"("status");

-- CreateIndex
CREATE INDEX "FundRequest_requestedById_idx" ON "finance"."FundRequest"("requestedById");

-- CreateIndex
CREATE INDEX "FundRequest_department_idx" ON "finance"."FundRequest"("department");

-- CreateIndex
CREATE INDEX "FundRequest_createdAt_idx" ON "finance"."FundRequest"("createdAt");

-- CreateIndex
CREATE INDEX "FundRequestEvent_fundRequestId_idx" ON "finance"."FundRequestEvent"("fundRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_itemCode_key" ON "finance"."StoreItem"("itemCode");

-- CreateIndex
CREATE INDEX "StoreItem_category_isActive_idx" ON "finance"."StoreItem"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StoreMovement_movementNumber_key" ON "finance"."StoreMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "StoreMovement_storeItemId_occurredAt_idx" ON "finance"."StoreMovement"("storeItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "StoreMovement_type_occurredAt_idx" ON "finance"."StoreMovement"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "finance"."FundRequestEvent" ADD CONSTRAINT "FundRequestEvent_fundRequestId_fkey" FOREIGN KEY ("fundRequestId") REFERENCES "finance"."FundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."StoreMovement" ADD CONSTRAINT "StoreMovement_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "finance"."StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

