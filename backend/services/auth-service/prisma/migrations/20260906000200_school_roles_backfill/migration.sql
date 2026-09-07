-- One stable ID is shared by all domain backfills. Existing accounts remain school-owned.
INSERT INTO "auth"."schools"("id", "code", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'KILIMANJARO', 'Kilimanjaro Schools') ON CONFLICT DO NOTHING;
UPDATE "auth"."users" SET "schoolId" = '00000000-0000-4000-8000-000000000001' WHERE "schoolId" IS NULL;
INSERT INTO "auth"."user_role_assignments"("id", "userId", "role")
SELECT md5("id" || ':' || "role"::text), "id", "role" FROM "auth"."users" ON CONFLICT ("userId", "role") DO NOTHING;
-- All pre-migration sessions must renew with school and role claims.
UPDATE "auth"."refresh_tokens" SET "isRevoked" = true WHERE "isRevoked" = false;

DO $$ BEGIN
 IF EXISTS (SELECT lower(trim(email)) FROM auth.users WHERE email IS NOT NULL GROUP BY lower(trim(email)) HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Normalize duplicate user emails before migrating';
 END IF;
END $$;
UPDATE auth.users SET email = lower(trim(email)) WHERE email IS NOT NULL;
