DROP INDEX IF EXISTS "academics"."Subject_code_key";
CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "academics"."Subject"("schoolId", "code");
