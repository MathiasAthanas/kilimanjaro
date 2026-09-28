CREATE TABLE "auth"."account_deletion_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_deletion_requests_email_status_idx"
  ON "auth"."account_deletion_requests"("email", "status");
CREATE INDEX "account_deletion_requests_userId_status_idx"
  ON "auth"."account_deletion_requests"("userId", "status");

ALTER TABLE "auth"."account_deletion_requests"
  ADD CONSTRAINT "account_deletion_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "auth"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
