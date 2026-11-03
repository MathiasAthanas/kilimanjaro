-- Additive: lessons carry the topic / syllabus unit the teacher enters.
ALTER TABLE "elearning"."lessons" ADD COLUMN IF NOT EXISTS "topic" TEXT;
