CREATE TYPE "academics"."VenueType" AS ENUM (
  'CLASSROOM',
  'HALL',
  'SPORTS_GROUND',
  'LABORATORY',
  'LIBRARY',
  'MUSIC_ROOM',
  'COMPUTER_LAB',
  'OTHER'
);

CREATE TYPE "academics"."TimetableType" AS ENUM (
  'CLASS',
  'EXTRACURRICULAR',
  'CUSTOM'
);

CREATE TYPE "academics"."SlotActivityType" AS ENUM (
  'LESSON',
  'BREAK',
  'ASSEMBLY',
  'SPORTS',
  'CLUB',
  'ARTS',
  'MUSIC',
  'EXAM',
  'CUSTOM'
);

CREATE TABLE "academics"."Venue" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "name" TEXT NOT NULL,
  "type" "academics"."VenueType" NOT NULL DEFAULT 'CLASSROOM',
  "capacity" INTEGER NOT NULL DEFAULT 40,
  "stageFilter" TEXT[],
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academics"."TimetableActivity" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "activityType" "academics"."SlotActivityType" NOT NULL DEFAULT 'LESSON',
  "defaultDuration" INTEGER NOT NULL DEFAULT 40,
  "stageFilter" TEXT[],
  "description" TEXT,
  "colorCode" TEXT DEFAULT '#4338CA',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimetableActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academics"."TimetableSheet" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "name" TEXT NOT NULL,
  "timetableType" "academics"."TimetableType" NOT NULL DEFAULT 'CLASS',
  "stage" TEXT,
  "classId" TEXT,
  "className" TEXT,
  "academicYearId" TEXT NOT NULL,
  "termId" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetableSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academics"."TimetableSlot" (
  "id" TEXT NOT NULL,
  "sheetId" TEXT NOT NULL,
  "dayOfWeek" "academics"."DayOfWeek" NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "activityType" "academics"."SlotActivityType" NOT NULL DEFAULT 'LESSON',
  "label" TEXT,
  "activityId" TEXT,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "teacherId" TEXT,
  "teacherName" TEXT,
  "classId" TEXT,
  "className" TEXT,
  "venueId" TEXT,
  "combinationId" TEXT,
  "attendeeIds" TEXT[],
  "staffIds" TEXT[],
  "staffNames" TEXT[],
  "notes" TEXT,
  "colorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Venue_schoolId_idx" ON "academics"."Venue"("schoolId");
CREATE INDEX "TimetableSheet_schoolId_idx" ON "academics"."TimetableSheet"("schoolId");
CREATE INDEX "TimetableSheet_academicYearId_timetableType_idx" ON "academics"."TimetableSheet"("academicYearId", "timetableType");
CREATE INDEX "TimetableSlot_sheetId_dayOfWeek_idx" ON "academics"."TimetableSlot"("sheetId", "dayOfWeek");

ALTER TABLE "academics"."TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_sheetId_fkey"
  FOREIGN KEY ("sheetId") REFERENCES "academics"."TimetableSheet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academics"."TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "academics"."TimetableActivity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academics"."TimetableSlot"
  ADD CONSTRAINT "TimetableSlot_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "academics"."Venue"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
