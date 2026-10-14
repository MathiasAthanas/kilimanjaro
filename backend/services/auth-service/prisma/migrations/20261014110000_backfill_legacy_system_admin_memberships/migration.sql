-- Backfill the legacy group-wide SYSTEM_ADMIN membership shape that may exist
-- on users whose primary role is no longer SYSTEM_ADMIN. The preceding
-- migration handles primary-role administrators; this migration deliberately
-- covers only the remaining active NULL-school grants.

WITH "legacy_administrators" AS (
  SELECT DISTINCT ON (membership."authUserId")
    membership."authUserId",
    COALESCE(membership."assignedById", administrator."createdBy", administrator."id") AS "assignedById"
  FROM "auth"."SchoolMembership" AS membership
  JOIN "auth"."users" AS administrator ON administrator."id" = membership."authUserId"
  WHERE membership."role" = 'SYSTEM_ADMIN'::"auth"."Role"
    AND membership."schoolId" IS NULL
    AND membership."isActive" = true
  ORDER BY membership."authUserId", membership."assignedAt" DESC
)
INSERT INTO "auth"."SchoolMembership" (
  "id", "authUserId", "schoolId", "role", "isActive", "assignedById", "assignedAt", "removedAt"
)
SELECT
  md5('system-admin-school:' || administrator."authUserId" || ':' || school."id"),
  administrator."authUserId",
  school."id",
  'SYSTEM_ADMIN'::"auth"."Role",
  true,
  administrator."assignedById",
  CURRENT_TIMESTAMP,
  NULL
FROM "legacy_administrators" AS administrator
CROSS JOIN "students"."School" AS school
WHERE school."isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "auth"."SchoolMembership" AS scoped
    WHERE scoped."authUserId" = administrator."authUserId"
      AND scoped."role" = 'SYSTEM_ADMIN'::"auth"."Role"
      AND scoped."schoolId" IS NOT NULL
      AND scoped."isActive" = true
  )
ON CONFLICT ("authUserId", "schoolId", "role")
DO UPDATE SET "isActive" = true, "removedAt" = NULL;

UPDATE "auth"."SchoolMembership" AS membership
SET "isActive" = false,
    "removedAt" = CURRENT_TIMESTAMP
WHERE membership."role" = 'SYSTEM_ADMIN'::"auth"."Role"
  AND membership."schoolId" IS NULL
  AND membership."isActive" = true
  AND EXISTS (
    SELECT 1
    FROM "auth"."SchoolMembership" AS scoped
    WHERE scoped."authUserId" = membership."authUserId"
      AND scoped."role" = 'SYSTEM_ADMIN'::"auth"."Role"
      AND scoped."schoolId" IS NOT NULL
      AND scoped."isActive" = true
  );
