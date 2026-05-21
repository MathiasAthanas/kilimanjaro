-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateEnum
CREATE TYPE "finance"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'WAIVED');

-- CreateEnum
CREATE TYPE "finance"."PaymentMethod" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'WAIVER', 'SCHOLARSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "finance"."PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "finance"."ApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "finance"."ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "finance"."FinancialAuditAction" AS ENUM ('FEE_CATEGORY_CREATED', 'FEE_CATEGORY_UPDATED', 'FEE_CATEGORY_DEACTIVATED', 'FEE_STRUCTURE_CREATED', 'FEE_STRUCTURE_UPDATED', 'FEE_STRUCTURE_DEACTIVATED', 'INVOICE_GENERATED', 'INVOICE_ISSUED', 'INVOICE_CANCELLED', 'INVOICE_WAIVED', 'INVOICE_DISCOUNT_APPLIED', 'STUDENT_FEE_ASSIGNED', 'STUDENT_FEE_REMOVED', 'PAYMENT_RECORDED', 'PAYMENT_CONFIRMED', 'PAYMENT_REJECTED', 'PAYMENT_REFUNDED', 'MANUAL_PAYMENT_APPROVED', 'MANUAL_PAYMENT_REJECTED', 'RECEIPT_ISSUED', 'RECEIPT_VOIDED', 'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DISPOSED');

-- CreateEnum
CREATE TYPE "finance"."AssetCategory" AS ENUM ('FURNITURE', 'ELECTRONICS', 'VEHICLE', 'BUILDING', 'EQUIPMENT', 'LABORATORY', 'LIBRARY', 'SPORTS', 'OTHER');

-- CreateEnum
CREATE TYPE "finance"."AssetType" AS ENUM ('FIXED', 'MOVABLE');

-- CreateEnum
CREATE TYPE "finance"."AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CONDEMNED');

-- CreateEnum
CREATE TYPE "finance"."AssetStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST', 'STOLEN');

-- CreateTable
CREATE TABLE "finance"."FeeCategory" (    "id" TEXT NOT NULL,    "name" TEXT NOT NULL,    "code" TEXT NOT NULL,    "description" TEXT,    "isOptional" BOOLEAN NOT NULL DEFAULT true,    "isBillablePerTerm" BOOLEAN NOT NULL DEFAULT true,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "displayOrder" INTEGER NOT NULL DEFAULT 0,    "createdById" TEXT NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    "updatedById" TEXT,    CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."FeeStructure" (    "id" TEXT NOT NULL,    "feeCategoryId" TEXT NOT NULL,    "classId" TEXT,    "classLevel" INTEGER,    "academicYearId" TEXT NOT NULL,    "termId" TEXT,    "amount" DECIMAL(12,2) NOT NULL,    "currency" TEXT NOT NULL DEFAULT 'TZS',    "isActive" BOOLEAN NOT NULL DEFAULT true,    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "effectiveTo" TIMESTAMP(3),    "createdById" TEXT NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    "updatedById" TEXT,    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."StudentFeeAssignment" (    "id" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "feeCategoryId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "termId" TEXT,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "assignedById" TEXT NOT NULL,    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "notes" TEXT,    CONSTRAINT "StudentFeeAssignment_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Invoice" (    "id" TEXT NOT NULL,    "invoiceNumber" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "subtotal" DECIMAL(12,2) NOT NULL,    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,    "discountReason" TEXT,    "totalAmount" DECIMAL(12,2) NOT NULL,    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,    "outstandingBalance" DECIMAL(12,2) NOT NULL,    "currency" TEXT NOT NULL DEFAULT 'TZS',    "status" "finance"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',    "dueDate" TIMESTAMP(3) NOT NULL,    "issuedAt" TIMESTAMP(3),    "issuedById" TEXT,    "cancelledAt" TIMESTAMP(3),    "cancelledById" TEXT,    "cancellationReason" TEXT,    "waivedAt" TIMESTAMP(3),    "waivedById" TEXT,    "waiverReason" TEXT,    "pdfUrl" TEXT,    "academicCleared" BOOLEAN NOT NULL DEFAULT false,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."InvoiceLineItem" (    "id" TEXT NOT NULL,    "invoiceId" TEXT NOT NULL,    "feeStructureId" TEXT NOT NULL,    "feeCategoryId" TEXT NOT NULL,    "feeCategoryName" TEXT NOT NULL,    "amount" DECIMAL(12,2) NOT NULL,    "currency" TEXT NOT NULL DEFAULT 'TZS',    "isPaid" BOOLEAN NOT NULL DEFAULT false,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Payment" (    "id" TEXT NOT NULL,    "paymentNumber" TEXT NOT NULL,    "invoiceId" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "amount" DECIMAL(12,2) NOT NULL,    "currency" TEXT NOT NULL DEFAULT 'TZS',    "method" "finance"."PaymentMethod" NOT NULL,    "status" "finance"."PaymentStatus" NOT NULL,    "referenceNumber" TEXT,    "payerName" TEXT,    "payerPhone" TEXT,    "paidAt" TIMESTAMP(3),    "confirmedAt" TIMESTAMP(3),    "confirmedById" TEXT,    "rejectedAt" TIMESTAMP(3),    "rejectedById" TEXT,    "rejectionReason" TEXT,    "refundedAt" TIMESTAMP(3),    "refundedById" TEXT,    "refundReason" TEXT,    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,    "approvalStatus" "finance"."ApprovalStatus",    "approvedAt" TIMESTAMP(3),    "approvedById" TEXT,    "notes" TEXT,    "ipAddress" TEXT,    "webhookPayload" JSONB,    "receiptId" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Receipt" (    "id" TEXT NOT NULL,    "receiptNumber" TEXT NOT NULL,    "paymentId" TEXT NOT NULL,    "invoiceId" TEXT NOT NULL,    "studentId" TEXT NOT NULL,    "studentName" TEXT NOT NULL,    "classId" TEXT NOT NULL,    "termId" TEXT NOT NULL,    "academicYearId" TEXT NOT NULL,    "amount" DECIMAL(12,2) NOT NULL,    "currency" TEXT NOT NULL DEFAULT 'TZS',    "method" "finance"."PaymentMethod" NOT NULL,    "referenceNumber" TEXT,    "paidAt" TIMESTAMP(3) NOT NULL,    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "issuedById" TEXT NOT NULL,    "pdfUrl" TEXT,    "isVoided" BOOLEAN NOT NULL DEFAULT false,    "voidedAt" TIMESTAMP(3),    "voidedById" TEXT,    "voidReason" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."ManualPaymentApproval" (    "id" TEXT NOT NULL,    "paymentId" TEXT NOT NULL,    "requestedById" TEXT NOT NULL,    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "reviewedById" TEXT,    "reviewedAt" TIMESTAMP(3),    "decision" "finance"."ApprovalDecision",    "rejectionReason" TEXT,    "notes" TEXT,    "supportingDocumentUrl" TEXT,    CONSTRAINT "ManualPaymentApproval_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."FinancialAuditLog" (    "id" TEXT NOT NULL,    "entityType" TEXT NOT NULL,    "entityId" TEXT NOT NULL,    "action" "finance"."FinancialAuditAction" NOT NULL,    "performedById" TEXT NOT NULL,    "performedByRole" TEXT NOT NULL,    "previousValue" JSONB,    "newValue" JSONB,    "metadata" JSONB,    "ipAddress" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."Asset" (    "id" TEXT NOT NULL,    "assetNumber" TEXT NOT NULL,    "name" TEXT NOT NULL,    "description" TEXT,    "category" "finance"."AssetCategory" NOT NULL,    "type" "finance"."AssetType" NOT NULL,    "serialNumber" TEXT,    "brand" TEXT,    "model" TEXT,    "purchaseDate" TIMESTAMP(3),    "purchaseCost" DECIMAL(12,2),    "currentValue" DECIMAL(12,2),    "currency" TEXT NOT NULL DEFAULT 'TZS',    "location" TEXT,    "condition" "finance"."AssetCondition" NOT NULL,    "status" "finance"."AssetStatus" NOT NULL,    "assignedTo" TEXT,    "warrantyExpiryDate" TIMESTAMP(3),    "disposalDate" TIMESTAMP(3),    "disposalReason" TEXT,    "disposalValue" DECIMAL(12,2),    "photoUrl" TEXT,    "notes" TEXT,    "createdById" TEXT NOT NULL,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    "updatedById" TEXT,    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "finance"."NumberSequence" (    "id" TEXT NOT NULL,    "year" INTEGER NOT NULL,    "value" INTEGER NOT NULL DEFAULT 0,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id"));

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_name_key" ON "finance"."FeeCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_code_key" ON "finance"."FeeCategory"("code");

-- CreateIndex
CREATE INDEX "FeeCategory_isActive_displayOrder_idx" ON "finance"."FeeCategory"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "FeeStructure_classId_termId_academicYearId_idx" ON "finance"."FeeStructure"("classId", "termId", "academicYearId");

-- CreateIndex
CREATE INDEX "FeeStructure_classLevel_termId_academicYearId_idx" ON "finance"."FeeStructure"("classLevel", "termId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_feeCategoryId_classId_termId_academicYearId_key" ON "finance"."FeeStructure"("feeCategoryId", "classId", "termId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentFeeAssignment_studentId_academicYearId_idx" ON "finance"."StudentFeeAssignment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAssignment_studentId_feeCategoryId_academicYearId_key" ON "finance"."StudentFeeAssignment"("studentId", "feeCategoryId", "academicYearId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "finance"."Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_studentId_status_idx" ON "finance"."Invoice"("studentId", "status");

-- CreateIndex
CREATE INDEX "Invoice_termId_status_idx" ON "finance"."Invoice"("termId", "status");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_status_idx" ON "finance"."Invoice"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_studentId_termId_academicYearId_key" ON "finance"."Invoice"("studentId", "termId", "academicYearId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "finance"."InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "finance"."Payment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptId_key" ON "finance"."Payment"("receiptId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "finance"."Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_studentId_status_idx" ON "finance"."Payment"("studentId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_requiresApproval_idx" ON "finance"."Payment"("status", "requiresApproval");

-- CreateIndex
CREATE INDEX "Payment_referenceNumber_idx" ON "finance"."Payment"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "finance"."Receipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "finance"."Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_studentId_idx" ON "finance"."Receipt"("studentId");

-- CreateIndex
CREATE INDEX "Receipt_paymentId_idx" ON "finance"."Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPaymentApproval_paymentId_key" ON "finance"."ManualPaymentApproval"("paymentId");

-- CreateIndex
CREATE INDEX "FinancialAuditLog_entityId_entityType_idx" ON "finance"."FinancialAuditLog"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "FinancialAuditLog_performedById_idx" ON "finance"."FinancialAuditLog"("performedById");

-- CreateIndex
CREATE INDEX "FinancialAuditLog_createdAt_idx" ON "finance"."FinancialAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetNumber_key" ON "finance"."Asset"("assetNumber");

-- CreateIndex
CREATE INDEX "Asset_status_category_idx" ON "finance"."Asset"("status", "category");

-- AddForeignKey
ALTER TABLE "finance"."FeeStructure" ADD CONSTRAINT "FeeStructure_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "finance"."FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "finance"."FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "finance"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "finance"."FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_feeCategoryId_fkey" FOREIGN KEY ("feeCategoryId") REFERENCES "finance"."FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "finance"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "finance"."Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "finance"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."ManualPaymentApproval" ADD CONSTRAINT "ManualPaymentApproval_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "finance"."Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;