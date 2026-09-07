CREATE TABLE "auth"."schools" (
 "id" TEXT PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
 "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "auth"."users" ADD COLUMN "schoolId" TEXT REFERENCES "auth"."schools"("id"),
 ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "users_schoolId_isActive_idx" ON "auth"."users"("schoolId", "isActive");
CREATE TABLE "auth"."user_role_assignments" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
 "role" "auth"."Role" NOT NULL, "assignedBy" TEXT, "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("userId", "role")
);
CREATE INDEX "user_role_assignments_role_userId_idx" ON "auth"."user_role_assignments"("role", "userId");
ALTER TYPE "auth"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_PROFILE_UPDATED';
ALTER TYPE "auth"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_EMAIL_CHANGED';
ALTER TYPE "auth"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_SCHOOL_CHANGED';
ALTER TYPE "auth"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_ROLES_CHANGED';
ALTER TYPE "auth"."AuditAction" ADD VALUE IF NOT EXISTS 'USERS_IMPORTED';

CREATE TABLE auth.import_batches (id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES auth.schools(id), "actorId" TEXT NOT NULL, fingerprint TEXT NOT NULL, result JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "import_batches_schoolId_idx" ON auth.import_batches("schoolId");
