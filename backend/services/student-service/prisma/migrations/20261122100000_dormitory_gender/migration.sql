-- Existing dormitories remain unclassified until an administrator reviews their roster.
ALTER TABLE "students"."Dormitory" ADD COLUMN IF NOT EXISTS "gender" "students"."Gender";
