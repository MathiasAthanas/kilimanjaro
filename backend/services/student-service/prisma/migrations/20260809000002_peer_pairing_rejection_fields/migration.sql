-- Add rejection tracking fields to PeerPairing
ALTER TABLE "students"."PeerPairing" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "students"."PeerPairing" ADD COLUMN "rejectionReason" TEXT;
