CREATE TYPE students."BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE students."RollCallSession" AS ENUM ('MORNING', 'EVENING');
CREATE TYPE students."HostelRollCallStatus" AS ENUM ('PRESENT', 'ABSENT', 'ON_LEAVE', 'EXCUSED');
CREATE TYPE students."LeaveType" AS ENUM ('HOME', 'TEMPORARY');
CREATE TYPE students."HostelLeaveStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'DEPARTED', 'RETURNED', 'CANCELLED');

CREATE TABLE students."Dormitory" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "totalBeds" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "eligibilityNotes" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dormitory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES students."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Dormitory_schoolId_code_key" UNIQUE ("schoolId", "code")
);
CREATE INDEX "Dormitory_schoolId_isActive_idx" ON students."Dormitory"("schoolId", "isActive");

CREATE TABLE students."DormitoryBed" (
  "id" TEXT PRIMARY KEY,
  "dormitoryId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" students."BedStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DormitoryBed_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES students."Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DormitoryBed_dormitoryId_label_key" UNIQUE ("dormitoryId", "label")
);
CREATE INDEX "DormitoryBed_dormitoryId_status_idx" ON students."DormitoryBed"("dormitoryId", "status");

CREATE TABLE students."DormitoryStaffAssignment" (
  "id" TEXT PRIMARY KEY,
  "dormitoryId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "staffRole" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "DormitoryStaffAssignment_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES students."Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DormitoryStaffAssignment_dormitoryId_staffUserId_key" UNIQUE ("dormitoryId", "staffUserId")
);
CREATE INDEX "DormitoryStaffAssignment_staffUserId_isActive_idx" ON students."DormitoryStaffAssignment"("staffUserId", "isActive");

CREATE TABLE students."DormitoryStudentAssignment" (
  "id" TEXT PRIMARY KEY,
  "dormitoryId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "bedId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "DormitoryStudentAssignment_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES students."Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DormitoryStudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES students."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DormitoryStudentAssignment_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES students."DormitoryBed"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "DormitoryStudentAssignment_dormitoryId_isActive_idx" ON students."DormitoryStudentAssignment"("dormitoryId", "isActive");
CREATE INDEX "DormitoryStudentAssignment_studentId_isActive_idx" ON students."DormitoryStudentAssignment"("studentId", "isActive");
CREATE INDEX "DormitoryStudentAssignment_bedId_isActive_idx" ON students."DormitoryStudentAssignment"("bedId", "isActive");
CREATE UNIQUE INDEX "DormitoryStudentAssignment_one_active_student_key" ON students."DormitoryStudentAssignment"("studentId") WHERE "isActive" = true;
CREATE UNIQUE INDEX "DormitoryStudentAssignment_one_active_bed_key" ON students."DormitoryStudentAssignment"("bedId") WHERE "isActive" = true AND "bedId" IS NOT NULL;

CREATE TABLE students."HostelRollCall" (
  "id" TEXT PRIMARY KEY,
  "dormitoryId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "session" students."RollCallSession" NOT NULL,
  "status" students."HostelRollCallStatus" NOT NULL,
  "note" TEXT,
  "markedBy" TEXT NOT NULL,
  "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HostelRollCall_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES students."Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HostelRollCall_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES students."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HostelRollCall_dormitoryId_studentId_date_session_key" UNIQUE ("dormitoryId", "studentId", "date", "session")
);
CREATE INDEX "HostelRollCall_dormitoryId_date_session_idx" ON students."HostelRollCall"("dormitoryId", "date", "session");

CREATE TABLE students."StudentLeave" (
  "id" TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "dormitoryId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "leaveType" students."LeaveType" NOT NULL,
  "reason" TEXT NOT NULL,
  "departureAt" TIMESTAMP(3) NOT NULL,
  "expectedReturnAt" TIMESTAMP(3) NOT NULL,
  "actualReturnAt" TIMESTAMP(3),
  "status" students."HostelLeaveStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedBy" TEXT NOT NULL,
  "decidedBy" TEXT,
  "departedBy" TEXT,
  "returnedBy" TEXT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentLeave_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES students."Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentLeave_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES students."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentLeave_termId_fkey" FOREIGN KEY ("termId") REFERENCES students."Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StudentLeave_schoolId_status_idx" ON students."StudentLeave"("schoolId", "status");
CREATE INDEX "StudentLeave_dormitoryId_status_idx" ON students."StudentLeave"("dormitoryId", "status");
CREATE INDEX "StudentLeave_studentId_status_idx" ON students."StudentLeave"("studentId", "status");

CREATE TABLE students."StudentLeaveEvent" (
  "id" TEXT PRIMARY KEY,
  "leaveId" TEXT NOT NULL,
  "fromStatus" students."HostelLeaveStatus",
  "toStatus" students."HostelLeaveStatus" NOT NULL,
  "note" TEXT,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentLeaveEvent_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES students."StudentLeave"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentLeaveEvent_leaveId_createdAt_idx" ON students."StudentLeaveEvent"("leaveId", "createdAt");
