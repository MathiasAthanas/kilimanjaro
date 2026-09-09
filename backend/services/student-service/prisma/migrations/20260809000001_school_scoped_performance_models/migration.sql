-- Add schoolId to PeerPairing for multi-school isolation
ALTER TABLE "students"."PeerPairing" ADD COLUMN "schoolId" TEXT;
CREATE INDEX "PeerPairing_schoolId_idx" ON "students"."PeerPairing" ("schoolId");

-- Add schoolId to PerformanceAlert for multi-school isolation
ALTER TABLE "students"."PerformanceAlert" ADD COLUMN "schoolId" TEXT;
CREATE INDEX "PerformanceAlert_schoolId_idx" ON "students"."PerformanceAlert" ("schoolId");

-- Back-fill schoolId on PeerPairing from the class relation
UPDATE "students"."PeerPairing" pp
SET "schoolId" = c."schoolId"
FROM "students"."Class" c
WHERE pp."classId" = c.id AND c."schoolId" IS NOT NULL;

-- Back-fill schoolId on PerformanceAlert from the student relation
UPDATE "students"."PerformanceAlert" pa
SET "schoolId" = s."schoolId"
FROM "students"."Student" s
WHERE pa."studentId" = s.id AND s."schoolId" IS NOT NULL;
