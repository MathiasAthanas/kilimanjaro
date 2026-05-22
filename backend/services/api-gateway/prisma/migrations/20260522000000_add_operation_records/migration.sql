CREATE SCHEMA IF NOT EXISTS "operations";

CREATE TABLE IF NOT EXISTS "operations"."operation_records" (
  "collection" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "operation_records_pkey" PRIMARY KEY ("collection", "id")
);

CREATE INDEX IF NOT EXISTS "operation_records_collection_updatedAt_idx"
  ON "operations"."operation_records"("collection", "updatedAt");
