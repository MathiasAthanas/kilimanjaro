-- SYSTEM_ADMIN is an operational school role. Keep existing administrators
-- reachable by converting only legacy group-only memberships into memberships
-- for the schools that already exist at rollout. Future schools are not added.

INSERT INTO "auth"."SchoolMembership" (
  "id", "authUserId", "schoolId", "role", "isActive", "assignedById", "assignedAt", "removedAt"
)
SELECT
  md5('system-admin-school:' || administrator."id" || ':' || school."id"),
  administrator."id",
  school."id",
  'SYSTEM_ADMIN'::"auth"."Role",
  true,
  COALESCE(administrator."createdBy", administrator."id"),
  CURRENT_TIMESTAMP,
  NULL
FROM "auth"."users" AS administrator
CROSS JOIN "students"."School" AS school
WHERE administrator."role" = 'SYSTEM_ADMIN'::"auth"."Role"
  AND school."isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "auth"."SchoolMembership" AS membership
    WHERE membership."authUserId" = administrator."id"
      AND membership."role" = 'SYSTEM_ADMIN'::"auth"."Role"
      AND membership."schoolId" IS NOT NULL
      AND membership."isActive" = true
  )
ON CONFLICT ("authUserId", "schoolId", "role")
DO UPDATE SET "isActive" = true, "removedAt" = NULL;

-- The legacy NULL membership was the group-wide grant. It is no longer active
-- after the school memberships above have been established.
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
