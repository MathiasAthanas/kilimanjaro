CREATE SCHEMA IF NOT EXISTS "elearning";

CREATE TYPE "elearning"."CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "elearning"."PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "elearning"."MaterialType" AS ENUM ('PDF', 'NOTE', 'SLIDE', 'IMAGE', 'VIDEO', 'LINK', 'FILE');
CREATE TYPE "elearning"."AssignmentType" AS ENUM ('FILE_UPLOAD', 'TEXT', 'BOTH');
CREATE TYPE "elearning"."SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADED', 'RETURNED');
CREATE TYPE "elearning"."QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');
CREATE TYPE "elearning"."AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_GRADED', 'MANUALLY_GRADED');
CREATE TYPE "elearning"."RevealPolicy" AS ENUM ('IMMEDIATELY', 'AFTER_CLOSE', 'NEVER');

CREATE TABLE "elearning"."course_spaces" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "classSubjectId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "description" TEXT,
  "coverColor" TEXT,
  "coverEmoji" TEXT,
  "status" "elearning"."CourseStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "enrolledCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_spaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."lessons" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "courseSpaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "weekNumber" INTEGER,
  "status" "elearning"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "estimatedMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."materials" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "lessonId" TEXT NOT NULL,
  "courseSpaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "elearning"."MaterialType" NOT NULL,
  "status" "elearning"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "body" TEXT,
  "fileKey" TEXT,
  "fileOriginalName" TEXT,
  "fileMimeType" TEXT,
  "fileSizeBytes" BIGINT,
  "externalUrl" TEXT,
  "thumbnailKey" TEXT,
  "downloadable" BOOLEAN NOT NULL DEFAULT true,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."assignments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "courseSpaceId" TEXT NOT NULL,
  "lessonId" TEXT,
  "title" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "type" "elearning"."AssignmentType" NOT NULL DEFAULT 'BOTH',
  "maxScore" DECIMAL(8,2),
  "dueAt" TIMESTAMP(3),
  "allowLateSubmission" BOOLEAN NOT NULL DEFAULT true,
  "latePenaltyPercent" DECIMAL(5,2),
  "status" "elearning"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "attachmentKey" TEXT,
  "attachmentName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."submissions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "courseSpaceId" TEXT NOT NULL,
  "textContent" TEXT,
  "fileKey" TEXT,
  "fileOriginalName" TEXT,
  "fileMimeType" TEXT,
  "fileSizeBytes" BIGINT,
  "submittedAt" TIMESTAMP(3),
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "status" "elearning"."SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "score" DECIMAL(8,2),
  "maxScore" DECIMAL(8,2),
  "feedback" TEXT,
  "gradedAt" TIMESTAMP(3),
  "gradedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."quizzes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "courseSpaceId" TEXT NOT NULL,
  "lessonId" TEXT,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "timeLimitMinutes" INTEGER,
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
  "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
  "showCorrectAfter" "elearning"."RevealPolicy" NOT NULL DEFAULT 'AFTER_CLOSE',
  "passingScore" DECIMAL(5,2),
  "status" "elearning"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "totalPoints" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."quiz_questions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "quizId" TEXT NOT NULL,
  "type" "elearning"."QuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "imageKey" TEXT,
  "points" DECIMAL(8,2) NOT NULL DEFAULT 1,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "explanation" TEXT,
  "correctAnswer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."quiz_options" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "questionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quiz_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."quiz_attempts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "quizId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "courseSpaceId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "timeTakenSeconds" INTEGER,
  "status" "elearning"."AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "totalScore" DECIMAL(8,2),
  "maxScore" DECIMAL(8,2),
  "percentScore" DECIMAL(5,2),
  "isPassed" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."quiz_answers" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "selectedOptionId" TEXT,
  "textAnswer" TEXT,
  "isCorrect" BOOLEAN,
  "scoreAwarded" DECIMAL(8,2),
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."course_enrollments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "courseSpaceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3),
  CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."material_progress" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "materialId" TEXT NOT NULL,
  "courseSpaceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3),
  "isDownloaded" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "viewDurationSec" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "material_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."lesson_progress" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "lessonId" TEXT NOT NULL,
  "courseSpaceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "percentComplete" DECIMAL(5,2) NOT NULL DEFAULT 0,
  CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."course_announcements" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "courseSpaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "elearning"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."discussion_threads" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "courseSpaceId" TEXT NOT NULL,
  "lessonId" TEXT,
  "assignmentId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discussion_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."discussion_replies" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "threadId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discussion_replies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elearning"."audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "actorId" TEXT,
  "actorRole" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_spaces_classSubjectId_termId_key" ON "elearning"."course_spaces"("classSubjectId", "termId");
CREATE INDEX "course_spaces_teacherId_status_idx" ON "elearning"."course_spaces"("teacherId", "status");
CREATE INDEX "course_spaces_termId_idx" ON "elearning"."course_spaces"("termId");
CREATE INDEX "lessons_courseSpaceId_orderIndex_idx" ON "elearning"."lessons"("courseSpaceId", "orderIndex");
CREATE INDEX "materials_lessonId_orderIndex_idx" ON "elearning"."materials"("lessonId", "orderIndex");
CREATE INDEX "materials_courseSpaceId_status_idx" ON "elearning"."materials"("courseSpaceId", "status");
CREATE INDEX "assignments_courseSpaceId_status_idx" ON "elearning"."assignments"("courseSpaceId", "status");
CREATE INDEX "assignments_dueAt_idx" ON "elearning"."assignments"("dueAt");
CREATE UNIQUE INDEX "submissions_assignmentId_studentId_key" ON "elearning"."submissions"("assignmentId", "studentId");
CREATE INDEX "submissions_courseSpaceId_studentId_idx" ON "elearning"."submissions"("courseSpaceId", "studentId");
CREATE INDEX "submissions_status_idx" ON "elearning"."submissions"("status");
CREATE INDEX "quizzes_courseSpaceId_status_idx" ON "elearning"."quizzes"("courseSpaceId", "status");
CREATE INDEX "quiz_questions_quizId_orderIndex_idx" ON "elearning"."quiz_questions"("quizId", "orderIndex");
CREATE INDEX "quiz_options_questionId_orderIndex_idx" ON "elearning"."quiz_options"("questionId", "orderIndex");
CREATE UNIQUE INDEX "quiz_attempts_quizId_studentId_attemptNumber_key" ON "elearning"."quiz_attempts"("quizId", "studentId", "attemptNumber");
CREATE INDEX "quiz_attempts_courseSpaceId_studentId_idx" ON "elearning"."quiz_attempts"("courseSpaceId", "studentId");
CREATE UNIQUE INDEX "quiz_answers_attemptId_questionId_key" ON "elearning"."quiz_answers"("attemptId", "questionId");
CREATE UNIQUE INDEX "course_enrollments_courseSpaceId_studentId_key" ON "elearning"."course_enrollments"("courseSpaceId", "studentId");
CREATE INDEX "course_enrollments_studentId_idx" ON "elearning"."course_enrollments"("studentId");
CREATE UNIQUE INDEX "material_progress_materialId_studentId_key" ON "elearning"."material_progress"("materialId", "studentId");
CREATE INDEX "material_progress_courseSpaceId_studentId_idx" ON "elearning"."material_progress"("courseSpaceId", "studentId");
CREATE UNIQUE INDEX "lesson_progress_lessonId_studentId_key" ON "elearning"."lesson_progress"("lessonId", "studentId");
CREATE INDEX "lesson_progress_courseSpaceId_studentId_idx" ON "elearning"."lesson_progress"("courseSpaceId", "studentId");
CREATE INDEX "course_announcements_courseSpaceId_isPinned_idx" ON "elearning"."course_announcements"("courseSpaceId", "isPinned");
CREATE INDEX "discussion_threads_courseSpaceId_isPinned_idx" ON "elearning"."discussion_threads"("courseSpaceId", "isPinned");
CREATE INDEX "discussion_replies_threadId_idx" ON "elearning"."discussion_replies"("threadId");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "elearning"."audit_logs"("action", "createdAt");
CREATE INDEX "audit_logs_actorId_idx" ON "elearning"."audit_logs"("actorId");

ALTER TABLE "elearning"."lessons" ADD CONSTRAINT "lessons_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."materials" ADD CONSTRAINT "materials_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "elearning"."lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."materials" ADD CONSTRAINT "materials_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."assignments" ADD CONSTRAINT "assignments_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."assignments" ADD CONSTRAINT "assignments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "elearning"."lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "elearning"."submissions" ADD CONSTRAINT "submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "elearning"."assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."submissions" ADD CONSTRAINT "submissions_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."quizzes" ADD CONSTRAINT "quizzes_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."quizzes" ADD CONSTRAINT "quizzes_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "elearning"."lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "elearning"."quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "elearning"."quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."quiz_options" ADD CONSTRAINT "quiz_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "elearning"."quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "elearning"."quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."quiz_answers" ADD CONSTRAINT "quiz_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "elearning"."quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."quiz_answers" ADD CONSTRAINT "quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "elearning"."quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."course_enrollments" ADD CONSTRAINT "course_enrollments_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."material_progress" ADD CONSTRAINT "material_progress_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "elearning"."materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."material_progress" ADD CONSTRAINT "material_progress_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "elearning"."lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."lesson_progress" ADD CONSTRAINT "lesson_progress_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."course_announcements" ADD CONSTRAINT "course_announcements_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."discussion_threads" ADD CONSTRAINT "discussion_threads_courseSpaceId_fkey" FOREIGN KEY ("courseSpaceId") REFERENCES "elearning"."course_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elearning"."discussion_replies" ADD CONSTRAINT "discussion_replies_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "elearning"."discussion_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
