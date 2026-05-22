CREATE TABLE "finance"."StudentGroup" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance"."StudentGroupMembership" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "StudentGroupMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentGroup_code_key" ON "finance"."StudentGroup"("code");
CREATE INDEX "StudentGroup_isActive_code_idx" ON "finance"."StudentGroup"("isActive", "code");
CREATE UNIQUE INDEX "StudentGroupMembership_studentId_groupId_key" ON "finance"."StudentGroupMembership"("studentId", "groupId");
CREATE INDEX "StudentGroupMembership_studentId_isActive_idx" ON "finance"."StudentGroupMembership"("studentId", "isActive");
CREATE INDEX "StudentGroupMembership_groupId_isActive_idx" ON "finance"."StudentGroupMembership"("groupId", "isActive");

ALTER TABLE "finance"."StudentGroupMembership" ADD CONSTRAINT "StudentGroupMembership_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "finance"."StudentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
