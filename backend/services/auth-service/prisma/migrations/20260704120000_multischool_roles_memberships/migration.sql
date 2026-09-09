-- Multi-school expansion: new group/school roles + membership table

ALTER TYPE "auth"."Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "auth"."Role" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "auth"."Role" ADD VALUE IF NOT EXISTS 'HEAD_OF_SCHOOL';
ALTER TYPE "auth"."Role" ADD VALUE IF NOT EXISTS 'HEAD_OF_FINANCE';

CREATE TABLE "auth"."SchoolMembership" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "schoolId" TEXT,
    "role" "auth"."Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolMembership_authUserId_schoolId_role_key" ON "auth"."SchoolMembership"("authUserId", "schoolId", "role");
CREATE INDEX "SchoolMembership_schoolId_role_isActive_idx" ON "auth"."SchoolMembership"("schoolId", "role", "isActive");
CREATE INDEX "SchoolMembership_authUserId_isActive_idx" ON "auth"."SchoolMembership"("authUserId", "isActive");

ALTER TABLE "auth"."SchoolMembership" ADD CONSTRAINT "SchoolMembership_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
