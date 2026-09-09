-- Redesigned fund-request approval chain:
-- initiate (HOD or Head of School) → Head of School approval → Finance review → Manager approval → disburse

ALTER TYPE "finance"."FundRequestStatus" ADD VALUE IF NOT EXISTS 'SCHOOL_APPROVED';
ALTER TYPE "finance"."FundRequestStatus" ADD VALUE IF NOT EXISTS 'FINANCE_REVIEWED';
ALTER TYPE "finance"."FundRequestStatus" ADD VALUE IF NOT EXISTS 'MANAGER_APPROVED';

ALTER TYPE "finance"."FundRequestAction" ADD VALUE IF NOT EXISTS 'SCHOOL_APPROVED';
ALTER TYPE "finance"."FundRequestAction" ADD VALUE IF NOT EXISTS 'FINANCE_REVIEWED';
ALTER TYPE "finance"."FundRequestAction" ADD VALUE IF NOT EXISTS 'MANAGER_APPROVED';

ALTER TABLE "finance"."FundRequest" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
ALTER TABLE "finance"."FundRequest" ADD COLUMN IF NOT EXISTS "managerName" TEXT;
ALTER TABLE "finance"."FundRequest" ADD COLUMN IF NOT EXISTS "managerNote" TEXT;
ALTER TABLE "finance"."FundRequest" ADD COLUMN IF NOT EXISTS "managerDecidedAt" TIMESTAMP(3);
