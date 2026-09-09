-- Add periodsPerWeek to ClassSubject so timetable auto-generation can use the
-- actual configured periods rather than a hardcoded default of 4.
ALTER TABLE "academics"."ClassSubject" ADD COLUMN "periodsPerWeek" INTEGER NOT NULL DEFAULT 4;
