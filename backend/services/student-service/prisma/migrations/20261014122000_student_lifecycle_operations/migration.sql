CREATE TABLE "students"."StudentLifecycleOperation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "classId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "impact" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentLifecycleOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentLifecycleOperation_schoolId_createdAt_idx"
  ON "students"."StudentLifecycleOperation"("schoolId", "createdAt");
CREATE INDEX "StudentLifecycleOperation_classId_createdAt_idx"
  ON "students"."StudentLifecycleOperation"("classId", "createdAt");
CREATE INDEX "StudentLifecycleOperation_actorId_createdAt_idx"
  ON "students"."StudentLifecycleOperation"("actorId", "createdAt");
