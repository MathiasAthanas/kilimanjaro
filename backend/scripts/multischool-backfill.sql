-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-school auto-split backfill (Doc 08 §2 steps 2–4)
-- Creates the three stage-derived schools, stamps schoolId across all domains,
-- migrates PRINCIPAL → MANAGER, and derives SchoolMemberships.
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 2 — Create schools (fixed ids so seeds/scripts can reference them)
INSERT INTO "students"."School" ("id","name","code","type","gender","motto","isActive","createdBy","createdAt","updatedAt")
VALUES
  ('00000000-0000-4000-8000-000000000001','Kilimanjaro Nursery School','KS-NUR','NURSERY','BOTH','Little steps, bright futures',true,'system',NOW(),NOW()),
  ('00000000-0000-4000-8000-000000000002','Kilimanjaro Primary School','KS-PRI','PRIMARY','BOTH','Excellence from the start',true,'system',NOW(),NOW()),
  ('00000000-0000-4000-8000-000000000003','Kilimanjaro Secondary School','KS-SEC','SECONDARY','BOTH','Knowledge is power',true,'system',NOW(),NOW())
ON CONFLICT ("code") DO NOTHING;

-- Step 3 — Backfill schoolId
-- 3a. Classes by education stage
UPDATE "students"."Class" SET "schoolId" = CASE
  WHEN "educationStage" IN ('NURSERY','PRE_UNIT') THEN '00000000-0000-4000-8000-000000000001'
  WHEN "educationStage" = 'PRIMARY'               THEN '00000000-0000-4000-8000-000000000002'
  ELSE                                                 '00000000-0000-4000-8000-000000000003'
END
WHERE "schoolId" IS NULL;

-- 3b. Enrolments from their class
UPDATE "students"."Enrolment" e SET "schoolId" = c."schoolId"
FROM "students"."Class" c WHERE e."classId" = c."id" AND e."schoolId" IS NULL;

-- 3c. Students from their most recent enrolment
UPDATE "students"."Student" s SET "schoolId" = sub."schoolId"
FROM (
  SELECT DISTINCT ON ("studentId") "studentId", "schoolId"
  FROM "students"."Enrolment"
  WHERE "schoolId" IS NOT NULL
  ORDER BY "studentId", "isActive" DESC, "enrolledAt" DESC
) sub
WHERE s."id" = sub."studentId" AND s."schoolId" IS NULL;

-- 3d. Applicants from prospective class, else their education stage
UPDATE "students"."Applicant" a SET "schoolId" = c."schoolId"
FROM "students"."Class" c WHERE a."prospectiveClassId" = c."id" AND a."schoolId" IS NULL;
UPDATE "students"."Applicant" SET "schoolId" = CASE
  WHEN "educationStage" IN ('NURSERY','PRE_UNIT') THEN '00000000-0000-4000-8000-000000000001'
  WHEN "educationStage" = 'PRIMARY'               THEN '00000000-0000-4000-8000-000000000002'
  WHEN "educationStage" IS NOT NULL               THEN '00000000-0000-4000-8000-000000000003'
END
WHERE "schoolId" IS NULL;

-- 3e. Academic domain
UPDATE "academics"."ClassSubject" cs SET "schoolId" = c."schoolId"
FROM "students"."Class" c WHERE cs."classId" = c."id" AND cs."schoolId" IS NULL;

UPDATE "academics"."Assessment" a SET "schoolId" = cs."schoolId"
FROM "academics"."ClassSubject" cs WHERE a."classSubjectId" = cs."id" AND a."schoolId" IS NULL;

UPDATE "academics"."TermResult" tr SET "schoolId" = s."schoolId"
FROM "students"."Student" s WHERE tr."studentId" = s."id" AND tr."schoolId" IS NULL;

UPDATE "academics"."ReportCard" rc SET "schoolId" = c."schoolId"
FROM "students"."Class" c WHERE rc."classId" = c."id" AND rc."schoolId" IS NULL;

UPDATE "academics"."TimetableSheet" ts SET "schoolId" = c."schoolId"
FROM "students"."Class" c WHERE ts."classId" = c."id" AND ts."schoolId" IS NULL;

UPDATE "academics"."Timetable" t SET "schoolId" = c."schoolId"
FROM "students"."Class" c WHERE t."classId" = c."id" AND t."schoolId" IS NULL;

-- 3f. Finance domain (via student)
UPDATE "finance"."Invoice" i SET "schoolId" = s."schoolId"
FROM "students"."Student" s WHERE i."studentId" = s."id" AND i."schoolId" IS NULL;

UPDATE "finance"."Payment" p SET "schoolId" = i."schoolId"
FROM "finance"."Invoice" i WHERE p."invoiceId" = i."id" AND p."schoolId" IS NULL;

UPDATE "finance"."Receipt" r SET "schoolId" = p."schoolId"
FROM "finance"."Payment" p WHERE r."paymentId" = p."id" AND r."schoolId" IS NULL;

-- finance.EducationStage only has PRIMARY / O_LEVEL / A_LEVEL
UPDATE "finance"."FeeStructure" SET "schoolId" = CASE
  WHEN "educationStage" = 'PRIMARY'               THEN '00000000-0000-4000-8000-000000000002'
  WHEN "educationStage" IS NOT NULL               THEN '00000000-0000-4000-8000-000000000003'
END
WHERE "schoolId" IS NULL;

-- FeeCategory / StoreItem / Expense / FundRequest stay NULL = group-shared for now.

-- Step 4 — Roles & memberships
-- 4a. PRINCIPAL → MANAGER (primary role)
UPDATE "auth"."users" SET "role" = 'MANAGER' WHERE "role" = 'PRINCIPAL';

-- 4b. Group-role memberships (schoolId NULL)
INSERT INTO "auth"."SchoolMembership" ("id","authUserId","schoolId","role","isActive","assignedById","assignedAt")
SELECT gen_random_uuid(), u."id", NULL, u."role", true, 'migration', NOW()
FROM "auth"."users" u
WHERE u."role" IN ('MANAGER','SYSTEM_ADMIN','SUPER_ADMIN','HEAD_OF_FINANCE') AND u."isActive"
  AND NOT EXISTS (
    SELECT 1
    FROM "auth"."SchoolMembership" m
    WHERE m."authUserId" = u."id"
      AND m."schoolId" IS NULL
      AND m."role" = u."role"
  );

-- 4c. Teachers: membership per school where they teach
INSERT INTO "auth"."SchoolMembership" ("id","authUserId","schoolId","role","isActive","assignedById","assignedAt")
SELECT gen_random_uuid(), u."id", cs."schoolId", 'TEACHER'::"auth"."Role", true, 'migration', NOW()
FROM "auth"."users" u
JOIN (SELECT DISTINCT "teacherId", "schoolId" FROM "academics"."ClassSubject" WHERE "schoolId" IS NOT NULL AND "teacherId" IS NOT NULL) cs
  ON cs."teacherId" = u."id"
WHERE u."role" = 'TEACHER' AND u."isActive"
ON CONFLICT ("authUserId","schoolId","role") DO NOTHING;

-- 4d. Campus-wide staff of the former single school (HOD/FINANCE/AQA/ADMISSIONS/TEACHER
--     with no derivable school): membership in ALL current schools — preserves what
--     they could see before the split; Super Admin can tighten later.
INSERT INTO "auth"."SchoolMembership" ("id","authUserId","schoolId","role","isActive","assignedById","assignedAt")
SELECT gen_random_uuid(), u."id", sch."id", u."role", true, 'migration', NOW()
FROM "auth"."users" u
CROSS JOIN "students"."School" sch
WHERE u."isActive"
  AND (
    u."role" IN ('HEAD_OF_DEPARTMENT','FINANCE','ACADEMIC_QA','ADMISSIONS')
    OR (u."role" = 'TEACHER' AND NOT EXISTS (
          SELECT 1 FROM "auth"."SchoolMembership" m
          WHERE m."authUserId" = u."id" AND m."role" = 'TEACHER'))
  )
ON CONFLICT ("authUserId","schoolId","role") DO NOTHING;

-- 4e. Students: membership in their own school
INSERT INTO "auth"."SchoolMembership" ("id","authUserId","schoolId","role","isActive","assignedById","assignedAt")
SELECT gen_random_uuid(), s."authUserId", s."schoolId", 'STUDENT'::"auth"."Role", true, 'migration', NOW()
FROM "students"."Student" s
JOIN "auth"."users" au ON au."id" = s."authUserId"
WHERE s."schoolId" IS NOT NULL
ON CONFLICT ("authUserId","schoolId","role") DO NOTHING;

-- 4f. Parents: membership per child school
INSERT INTO "auth"."SchoolMembership" ("id","authUserId","schoolId","role","isActive","assignedById","assignedAt")
SELECT DISTINCT gen_random_uuid(), g."authUserId", s."schoolId", 'PARENT'::"auth"."Role", true, 'migration', NOW()
FROM "students"."Guardian" g
JOIN "students"."StudentGuardianLink" l ON l."guardianId" = g."id" AND l."isActive"
JOIN "students"."Student" s ON s."id" = l."studentId" AND s."schoolId" IS NOT NULL
JOIN "auth"."users" au ON au."id" = g."authUserId" AND au."role" = 'PARENT'
ON CONFLICT ("authUserId","schoolId","role") DO NOTHING;
