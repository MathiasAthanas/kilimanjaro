-- Multi-school scoping columns for finance domain

ALTER TABLE "finance"."Invoice"      ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."Payment"      ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."Receipt"      ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."FeeStructure" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."FundRequest"  ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."Expense"      ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."StoreItem"    ADD COLUMN "schoolId" TEXT;
ALTER TABLE "finance"."FeeCategory"  ADD COLUMN "schoolId" TEXT;

CREATE INDEX "Invoice_schoolId_idx"      ON "finance"."Invoice"("schoolId");
CREATE INDEX "Payment_schoolId_idx"      ON "finance"."Payment"("schoolId");
CREATE INDEX "FeeStructure_schoolId_idx" ON "finance"."FeeStructure"("schoolId");
CREATE INDEX "FundRequest_schoolId_idx"  ON "finance"."FundRequest"("schoolId");
