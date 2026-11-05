-- Subject codes describe a curriculum subject within an education stage.
-- The same code may therefore exist in Nursery, Primary, O-Level and A-Level,
-- while duplicates inside one stage remain blocked.
DROP INDEX IF EXISTS "academics"."Subject_code_key";

CREATE UNIQUE INDEX "Subject_code_educationStage_key"
  ON "academics"."Subject"("code", "educationStage");

-- PostgreSQL treats NULL values as distinct in a normal unique index. Keep
-- legacy stage-neutral subjects unique as well.
CREATE UNIQUE INDEX "Subject_code_stage_neutral_key"
  ON "academics"."Subject"("code")
  WHERE "educationStage" IS NULL;
