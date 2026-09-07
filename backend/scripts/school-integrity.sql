-- Run after all service migrations. NOT VALID preserves legacy rows while protecting all new writes.
CREATE UNIQUE INDEX IF NOT EXISTS "users_id_school_key" ON "auth"."users"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "import_batches_id_school_key" ON "auth"."import_batches"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_id_school_key" ON "notifications"."NotificationTemplate"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_id_school_key" ON "notifications"."Notification"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Announcement_id_school_key" ON "notifications"."Announcement"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_id_school_key" ON "notifications"."DeviceToken"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_id_school_key" ON "notifications"."NotificationPreference"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "SmsDeliveryLog_id_school_key" ON "notifications"."SmsDeliveryLog"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Student_id_school_key" ON "students"."Student"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Guardian_id_school_key" ON "students"."Guardian"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentGuardianLink_id_school_key" ON "students"."StudentGuardianLink"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicYear_id_school_key" ON "students"."AcademicYear"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Term_id_school_key" ON "students"."Term"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Class_id_school_key" ON "students"."Class"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClassPathway_id_school_key" ON "students"."ClassPathway"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Enrolment_id_school_key" ON "students"."Enrolment"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_id_school_key" ON "students"."AttendanceRecord"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "DisciplineRecord_id_school_key" ON "students"."DisciplineRecord"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceSnapshot_id_school_key" ON "students"."PerformanceSnapshot"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceTrend_id_school_key" ON "students"."PerformanceTrend"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceAlert_id_school_key" ON "students"."PerformanceAlert"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "PeerPairing_id_school_key" ON "students"."PeerPairing"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceEngineConfig_id_school_key" ON "students"."PerformanceEngineConfig"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_id_school_key" ON "students"."Department"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentHod_id_school_key" ON "students"."DepartmentHod"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "course_spaces_id_school_key" ON "elearning"."course_spaces"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "lessons_id_school_key" ON "elearning"."lessons"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "materials_id_school_key" ON "elearning"."materials"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_id_school_key" ON "elearning"."assignments"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_id_school_key" ON "elearning"."submissions"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "quizzes_id_school_key" ON "elearning"."quizzes"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_questions_id_school_key" ON "elearning"."quiz_questions"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_options_id_school_key" ON "elearning"."quiz_options"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_attempts_id_school_key" ON "elearning"."quiz_attempts"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_answers_id_school_key" ON "elearning"."quiz_answers"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "course_enrollments_id_school_key" ON "elearning"."course_enrollments"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "material_progress_id_school_key" ON "elearning"."material_progress"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_progress_id_school_key" ON "elearning"."lesson_progress"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "course_announcements_id_school_key" ON "elearning"."course_announcements"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "discussion_threads_id_school_key" ON "elearning"."discussion_threads"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "discussion_replies_id_school_key" ON "elearning"."discussion_replies"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_id_school_key" ON "elearning"."audit_logs"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "DashboardSnapshot_id_school_key" ON "analytics"."DashboardSnapshot"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "KpiHistory_id_school_key" ON "analytics"."KpiHistory"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "GeneratedReport_id_school_key" ON "analytics"."GeneratedReport"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "MetricEvent_id_school_key" ON "analytics"."MetricEvent"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_id_school_key" ON "academics"."Subject"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClassSubject_id_school_key" ON "academics"."ClassSubject"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "TermResult_id_school_key" ON "academics"."TermResult"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReportCard_id_school_key" ON "academics"."ReportCard"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_id_school_key" ON "academics"."Assessment"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTracker_id_school_key" ON "academics"."SyllabusTracker"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicIntervention_id_school_key" ON "academics"."AcademicIntervention"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_id_school_key" ON "finance"."Invoice"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_id_school_key" ON "finance"."Payment"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeCategory_id_school_key" ON "finance"."FeeCategory"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_id_school_key" ON "finance"."Receipt"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "operation_records_id_school_key" ON "operations"."operation_records"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentGroup_id_school_key" ON "finance"."StudentGroup"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentGroupMembership_id_school_key" ON "finance"."StudentGroupMembership"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeStructure_id_school_key" ON "finance"."FeeStructure"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentFeeAssignment_id_school_key" ON "finance"."StudentFeeAssignment"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceLineItem_id_school_key" ON "finance"."InvoiceLineItem"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "ManualPaymentApproval_id_school_key" ON "finance"."ManualPaymentApproval"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialAuditLog_id_school_key" ON "finance"."FinancialAuditLog"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_id_school_key" ON "finance"."Asset"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_id_school_key" ON "finance"."Expense"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "FundRequest_id_school_key" ON "finance"."FundRequest"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "FundRequestEvent_id_school_key" ON "finance"."FundRequestEvent"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreItem_id_school_key" ON "finance"."StoreItem"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreMovement_id_school_key" ON "finance"."StoreMovement"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "GradingScale_id_school_key" ON "academics"."GradingScale"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "GradeBoundary_id_school_key" ON "academics"."GradeBoundary"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentType_id_school_key" ON "academics"."AssessmentType"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Mark_id_school_key" ON "academics"."Mark"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubjectCombination_id_school_key" ON "academics"."SubjectCombination"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubjectCombinationSubject_id_school_key" ON "academics"."SubjectCombinationSubject"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentSubjectEnrollment_id_school_key" ON "academics"."StudentSubjectEnrollment"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalLog_id_school_key" ON "academics"."ApprovalLog"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Timetable_id_school_key" ON "academics"."Timetable"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicAuditLog_id_school_key" ON "academics"."AcademicAuditLog"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Venue_id_school_key" ON "academics"."Venue"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "TimetableActivity_id_school_key" ON "academics"."TimetableActivity"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "TimetableSheet_id_school_key" ON "academics"."TimetableSheet"(id, "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "TimetableSlot_id_school_key" ON "academics"."TimetableSlot"(id, "schoolId");
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmsDeliveryLog_notificationId_school_fk' AND conrelid = '"notifications"."SmsDeliveryLog"'::regclass) THEN
 ALTER TABLE "notifications"."SmsDeliveryLog" ADD CONSTRAINT "SmsDeliveryLog_notificationId_school_fk" FOREIGN KEY ("notificationId", "schoolId") REFERENCES "notifications"."Notification"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Guardian_authUserId_school_fk' AND conrelid = '"students"."Guardian"'::regclass) THEN
 ALTER TABLE "students"."Guardian" ADD CONSTRAINT "Guardian_authUserId_school_fk" FOREIGN KEY ("authUserId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentGuardianLink_studentId_school_fk' AND conrelid = '"students"."StudentGuardianLink"'::regclass) THEN
 ALTER TABLE "students"."StudentGuardianLink" ADD CONSTRAINT "StudentGuardianLink_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentGuardianLink_guardianId_school_fk' AND conrelid = '"students"."StudentGuardianLink"'::regclass) THEN
 ALTER TABLE "students"."StudentGuardianLink" ADD CONSTRAINT "StudentGuardianLink_guardianId_school_fk" FOREIGN KEY ("guardianId", "schoolId") REFERENCES "students"."Guardian"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Term_academicYearId_school_fk' AND conrelid = '"students"."Term"'::regclass) THEN
 ALTER TABLE "students"."Term" ADD CONSTRAINT "Term_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Class_academicYearId_school_fk' AND conrelid = '"students"."Class"'::regclass) THEN
 ALTER TABLE "students"."Class" ADD CONSTRAINT "Class_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Class_classTeacherId_school_fk' AND conrelid = '"students"."Class"'::regclass) THEN
 ALTER TABLE "students"."Class" ADD CONSTRAINT "Class_classTeacherId_school_fk" FOREIGN KEY ("classTeacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassPathway_fromClassId_school_fk' AND conrelid = '"students"."ClassPathway"'::regclass) THEN
 ALTER TABLE "students"."ClassPathway" ADD CONSTRAINT "ClassPathway_fromClassId_school_fk" FOREIGN KEY ("fromClassId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassPathway_toClassId_school_fk' AND conrelid = '"students"."ClassPathway"'::regclass) THEN
 ALTER TABLE "students"."ClassPathway" ADD CONSTRAINT "ClassPathway_toClassId_school_fk" FOREIGN KEY ("toClassId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassPathway_academicYearId_school_fk' AND conrelid = '"students"."ClassPathway"'::regclass) THEN
 ALTER TABLE "students"."ClassPathway" ADD CONSTRAINT "ClassPathway_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Enrolment_studentId_school_fk' AND conrelid = '"students"."Enrolment"'::regclass) THEN
 ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Enrolment_classId_school_fk' AND conrelid = '"students"."Enrolment"'::regclass) THEN
 ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Enrolment_academicYearId_school_fk' AND conrelid = '"students"."Enrolment"'::regclass) THEN
 ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Enrolment_termId_school_fk' AND conrelid = '"students"."Enrolment"'::regclass) THEN
 ALTER TABLE "students"."Enrolment" ADD CONSTRAINT "Enrolment_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_studentId_school_fk' AND conrelid = '"students"."AttendanceRecord"'::regclass) THEN
 ALTER TABLE "students"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_classId_school_fk' AND conrelid = '"students"."AttendanceRecord"'::regclass) THEN
 ALTER TABLE "students"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_termId_school_fk' AND conrelid = '"students"."AttendanceRecord"'::regclass) THEN
 ALTER TABLE "students"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DisciplineRecord_studentId_school_fk' AND conrelid = '"students"."DisciplineRecord"'::regclass) THEN
 ALTER TABLE "students"."DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceSnapshot_studentId_school_fk' AND conrelid = '"students"."PerformanceSnapshot"'::regclass) THEN
 ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceSnapshot_academicYearId_school_fk' AND conrelid = '"students"."PerformanceSnapshot"'::regclass) THEN
 ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceSnapshot_termId_school_fk' AND conrelid = '"students"."PerformanceSnapshot"'::regclass) THEN
 ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceSnapshot_subjectId_school_fk' AND conrelid = '"students"."PerformanceSnapshot"'::regclass) THEN
 ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceSnapshot_teacherId_school_fk' AND conrelid = '"students"."PerformanceSnapshot"'::regclass) THEN
 ALTER TABLE "students"."PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_teacherId_school_fk" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceTrend_studentId_school_fk' AND conrelid = '"students"."PerformanceTrend"'::regclass) THEN
 ALTER TABLE "students"."PerformanceTrend" ADD CONSTRAINT "PerformanceTrend_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceTrend_subjectId_school_fk' AND conrelid = '"students"."PerformanceTrend"'::regclass) THEN
 ALTER TABLE "students"."PerformanceTrend" ADD CONSTRAINT "PerformanceTrend_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceAlert_studentId_school_fk' AND conrelid = '"students"."PerformanceAlert"'::regclass) THEN
 ALTER TABLE "students"."PerformanceAlert" ADD CONSTRAINT "PerformanceAlert_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerformanceAlert_subjectId_school_fk' AND conrelid = '"students"."PerformanceAlert"'::regclass) THEN
 ALTER TABLE "students"."PerformanceAlert" ADD CONSTRAINT "PerformanceAlert_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PeerPairing_studentId_school_fk' AND conrelid = '"students"."PeerPairing"'::regclass) THEN
 ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PeerPairing_peerId_school_fk' AND conrelid = '"students"."PeerPairing"'::regclass) THEN
 ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_peerId_school_fk" FOREIGN KEY ("peerId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PeerPairing_subjectId_school_fk' AND conrelid = '"students"."PeerPairing"'::regclass) THEN
 ALTER TABLE "students"."PeerPairing" ADD CONSTRAINT "PeerPairing_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHod_academicYearId_school_fk' AND conrelid = '"students"."DepartmentHod"'::regclass) THEN
 ALTER TABLE "students"."DepartmentHod" ADD CONSTRAINT "DepartmentHod_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHod_departmentId_school_fk' AND conrelid = '"students"."DepartmentHod"'::regclass) THEN
 ALTER TABLE "students"."DepartmentHod" ADD CONSTRAINT "DepartmentHod_departmentId_school_fk" FOREIGN KEY ("departmentId", "schoolId") REFERENCES "students"."Department"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_spaces_academicYearId_school_fk' AND conrelid = '"elearning"."course_spaces"'::regclass) THEN
 ALTER TABLE "elearning"."course_spaces" ADD CONSTRAINT "course_spaces_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_spaces_termId_school_fk' AND conrelid = '"elearning"."course_spaces"'::regclass) THEN
 ALTER TABLE "elearning"."course_spaces" ADD CONSTRAINT "course_spaces_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_spaces_classSubjectId_school_fk' AND conrelid = '"elearning"."course_spaces"'::regclass) THEN
 ALTER TABLE "elearning"."course_spaces" ADD CONSTRAINT "course_spaces_classSubjectId_school_fk" FOREIGN KEY ("classSubjectId", "schoolId") REFERENCES "academics"."ClassSubject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_spaces_teacherId_school_fk' AND conrelid = '"elearning"."course_spaces"'::regclass) THEN
 ALTER TABLE "elearning"."course_spaces" ADD CONSTRAINT "course_spaces_teacherId_school_fk" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_spaces_combinationId_school_fk' AND conrelid = '"elearning"."course_spaces"'::regclass) THEN
 ALTER TABLE "elearning"."course_spaces" ADD CONSTRAINT "course_spaces_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_courseSpaceId_school_fk' AND conrelid = '"elearning"."lessons"'::regclass) THEN
 ALTER TABLE "elearning"."lessons" ADD CONSTRAINT "lessons_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materials_lessonId_school_fk' AND conrelid = '"elearning"."materials"'::regclass) THEN
 ALTER TABLE "elearning"."materials" ADD CONSTRAINT "materials_lessonId_school_fk" FOREIGN KEY ("lessonId", "schoolId") REFERENCES "elearning"."lessons"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materials_courseSpaceId_school_fk' AND conrelid = '"elearning"."materials"'::regclass) THEN
 ALTER TABLE "elearning"."materials" ADD CONSTRAINT "materials_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_courseSpaceId_school_fk' AND conrelid = '"elearning"."assignments"'::regclass) THEN
 ALTER TABLE "elearning"."assignments" ADD CONSTRAINT "assignments_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignments_lessonId_school_fk' AND conrelid = '"elearning"."assignments"'::regclass) THEN
 ALTER TABLE "elearning"."assignments" ADD CONSTRAINT "assignments_lessonId_school_fk" FOREIGN KEY ("lessonId", "schoolId") REFERENCES "elearning"."lessons"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_studentId_school_fk' AND conrelid = '"elearning"."submissions"'::regclass) THEN
 ALTER TABLE "elearning"."submissions" ADD CONSTRAINT "submissions_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_assignmentId_school_fk' AND conrelid = '"elearning"."submissions"'::regclass) THEN
 ALTER TABLE "elearning"."submissions" ADD CONSTRAINT "submissions_assignmentId_school_fk" FOREIGN KEY ("assignmentId", "schoolId") REFERENCES "elearning"."assignments"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_courseSpaceId_school_fk' AND conrelid = '"elearning"."submissions"'::regclass) THEN
 ALTER TABLE "elearning"."submissions" ADD CONSTRAINT "submissions_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_courseSpaceId_school_fk' AND conrelid = '"elearning"."quizzes"'::regclass) THEN
 ALTER TABLE "elearning"."quizzes" ADD CONSTRAINT "quizzes_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_lessonId_school_fk' AND conrelid = '"elearning"."quizzes"'::regclass) THEN
 ALTER TABLE "elearning"."quizzes" ADD CONSTRAINT "quizzes_lessonId_school_fk" FOREIGN KEY ("lessonId", "schoolId") REFERENCES "elearning"."lessons"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_quizId_school_fk' AND conrelid = '"elearning"."quiz_questions"'::regclass) THEN
 ALTER TABLE "elearning"."quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_school_fk" FOREIGN KEY ("quizId", "schoolId") REFERENCES "elearning"."quizzes"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_options_questionId_school_fk' AND conrelid = '"elearning"."quiz_options"'::regclass) THEN
 ALTER TABLE "elearning"."quiz_options" ADD CONSTRAINT "quiz_options_questionId_school_fk" FOREIGN KEY ("questionId", "schoolId") REFERENCES "elearning"."quiz_questions"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_studentId_school_fk' AND conrelid = '"elearning"."quiz_attempts"'::regclass) THEN
 ALTER TABLE "elearning"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_quizId_school_fk' AND conrelid = '"elearning"."quiz_attempts"'::regclass) THEN
 ALTER TABLE "elearning"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_school_fk" FOREIGN KEY ("quizId", "schoolId") REFERENCES "elearning"."quizzes"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_answers_attemptId_school_fk' AND conrelid = '"elearning"."quiz_answers"'::regclass) THEN
 ALTER TABLE "elearning"."quiz_answers" ADD CONSTRAINT "quiz_answers_attemptId_school_fk" FOREIGN KEY ("attemptId", "schoolId") REFERENCES "elearning"."quiz_attempts"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_answers_questionId_school_fk' AND conrelid = '"elearning"."quiz_answers"'::regclass) THEN
 ALTER TABLE "elearning"."quiz_answers" ADD CONSTRAINT "quiz_answers_questionId_school_fk" FOREIGN KEY ("questionId", "schoolId") REFERENCES "elearning"."quiz_questions"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_studentId_school_fk' AND conrelid = '"elearning"."course_enrollments"'::regclass) THEN
 ALTER TABLE "elearning"."course_enrollments" ADD CONSTRAINT "course_enrollments_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_courseSpaceId_school_fk' AND conrelid = '"elearning"."course_enrollments"'::regclass) THEN
 ALTER TABLE "elearning"."course_enrollments" ADD CONSTRAINT "course_enrollments_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_progress_studentId_school_fk' AND conrelid = '"elearning"."material_progress"'::regclass) THEN
 ALTER TABLE "elearning"."material_progress" ADD CONSTRAINT "material_progress_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_progress_materialId_school_fk' AND conrelid = '"elearning"."material_progress"'::regclass) THEN
 ALTER TABLE "elearning"."material_progress" ADD CONSTRAINT "material_progress_materialId_school_fk" FOREIGN KEY ("materialId", "schoolId") REFERENCES "elearning"."materials"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_progress_courseSpaceId_school_fk' AND conrelid = '"elearning"."material_progress"'::regclass) THEN
 ALTER TABLE "elearning"."material_progress" ADD CONSTRAINT "material_progress_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_studentId_school_fk' AND conrelid = '"elearning"."lesson_progress"'::regclass) THEN
 ALTER TABLE "elearning"."lesson_progress" ADD CONSTRAINT "lesson_progress_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_lessonId_school_fk' AND conrelid = '"elearning"."lesson_progress"'::regclass) THEN
 ALTER TABLE "elearning"."lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_school_fk" FOREIGN KEY ("lessonId", "schoolId") REFERENCES "elearning"."lessons"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_courseSpaceId_school_fk' AND conrelid = '"elearning"."lesson_progress"'::regclass) THEN
 ALTER TABLE "elearning"."lesson_progress" ADD CONSTRAINT "lesson_progress_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_announcements_courseSpaceId_school_fk' AND conrelid = '"elearning"."course_announcements"'::regclass) THEN
 ALTER TABLE "elearning"."course_announcements" ADD CONSTRAINT "course_announcements_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discussion_threads_courseSpaceId_school_fk' AND conrelid = '"elearning"."discussion_threads"'::regclass) THEN
 ALTER TABLE "elearning"."discussion_threads" ADD CONSTRAINT "discussion_threads_courseSpaceId_school_fk" FOREIGN KEY ("courseSpaceId", "schoolId") REFERENCES "elearning"."course_spaces"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discussion_replies_threadId_school_fk' AND conrelid = '"elearning"."discussion_replies"'::regclass) THEN
 ALTER TABLE "elearning"."discussion_replies" ADD CONSTRAINT "discussion_replies_threadId_school_fk" FOREIGN KEY ("threadId", "schoolId") REFERENCES "elearning"."discussion_threads"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KpiHistory_academicYearId_school_fk' AND conrelid = '"analytics"."KpiHistory"'::regclass) THEN
 ALTER TABLE "analytics"."KpiHistory" ADD CONSTRAINT "KpiHistory_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KpiHistory_termId_school_fk' AND conrelid = '"analytics"."KpiHistory"'::regclass) THEN
 ALTER TABLE "analytics"."KpiHistory" ADD CONSTRAINT "KpiHistory_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeneratedReport_academicYearId_school_fk' AND conrelid = '"analytics"."GeneratedReport"'::regclass) THEN
 ALTER TABLE "analytics"."GeneratedReport" ADD CONSTRAINT "GeneratedReport_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GeneratedReport_termId_school_fk' AND conrelid = '"analytics"."GeneratedReport"'::regclass) THEN
 ALTER TABLE "analytics"."GeneratedReport" ADD CONSTRAINT "GeneratedReport_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subject_departmentId_school_fk' AND conrelid = '"academics"."Subject"'::regclass) THEN
 ALTER TABLE "academics"."Subject" ADD CONSTRAINT "Subject_departmentId_school_fk" FOREIGN KEY ("departmentId", "schoolId") REFERENCES "students"."Department"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSubject_classId_school_fk' AND conrelid = '"academics"."ClassSubject"'::regclass) THEN
 ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSubject_academicYearId_school_fk' AND conrelid = '"academics"."ClassSubject"'::regclass) THEN
 ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSubject_subjectId_school_fk' AND conrelid = '"academics"."ClassSubject"'::regclass) THEN
 ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSubject_teacherId_school_fk' AND conrelid = '"academics"."ClassSubject"'::regclass) THEN
 ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_teacherId_school_fk" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSubject_combinationId_school_fk' AND conrelid = '"academics"."ClassSubject"'::regclass) THEN
 ALTER TABLE "academics"."ClassSubject" ADD CONSTRAINT "ClassSubject_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_studentId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_classId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_academicYearId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_termId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_subjectId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_classSubjectId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_classSubjectId_school_fk" FOREIGN KEY ("classSubjectId", "schoolId") REFERENCES "academics"."ClassSubject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_teacherId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_teacherId_school_fk" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermResult_combinationId_school_fk' AND conrelid = '"academics"."TermResult"'::regclass) THEN
 ALTER TABLE "academics"."TermResult" ADD CONSTRAINT "TermResult_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_studentId_school_fk' AND conrelid = '"academics"."ReportCard"'::regclass) THEN
 ALTER TABLE "academics"."ReportCard" ADD CONSTRAINT "ReportCard_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_classId_school_fk' AND conrelid = '"academics"."ReportCard"'::regclass) THEN
 ALTER TABLE "academics"."ReportCard" ADD CONSTRAINT "ReportCard_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_academicYearId_school_fk' AND conrelid = '"academics"."ReportCard"'::regclass) THEN
 ALTER TABLE "academics"."ReportCard" ADD CONSTRAINT "ReportCard_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_termId_school_fk' AND conrelid = '"academics"."ReportCard"'::regclass) THEN
 ALTER TABLE "academics"."ReportCard" ADD CONSTRAINT "ReportCard_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_combinationId_school_fk' AND conrelid = '"academics"."ReportCard"'::regclass) THEN
 ALTER TABLE "academics"."ReportCard" ADD CONSTRAINT "ReportCard_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_classId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_academicYearId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_termId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_subjectId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_classSubjectId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_classSubjectId_school_fk" FOREIGN KEY ("classSubjectId", "schoolId") REFERENCES "academics"."ClassSubject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_combinationId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_assessmentTypeId_school_fk' AND conrelid = '"academics"."Assessment"'::regclass) THEN
 ALTER TABLE "academics"."Assessment" ADD CONSTRAINT "Assessment_assessmentTypeId_school_fk" FOREIGN KEY ("assessmentTypeId", "schoolId") REFERENCES "academics"."AssessmentType"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SyllabusTracker_termId_school_fk' AND conrelid = '"academics"."SyllabusTracker"'::regclass) THEN
 ALTER TABLE "academics"."SyllabusTracker" ADD CONSTRAINT "SyllabusTracker_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SyllabusTracker_classSubjectId_school_fk' AND conrelid = '"academics"."SyllabusTracker"'::regclass) THEN
 ALTER TABLE "academics"."SyllabusTracker" ADD CONSTRAINT "SyllabusTracker_classSubjectId_school_fk" FOREIGN KEY ("classSubjectId", "schoolId") REFERENCES "academics"."ClassSubject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicIntervention_studentId_school_fk' AND conrelid = '"academics"."AcademicIntervention"'::regclass) THEN
 ALTER TABLE "academics"."AcademicIntervention" ADD CONSTRAINT "AcademicIntervention_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AcademicIntervention_subjectId_school_fk' AND conrelid = '"academics"."AcademicIntervention"'::regclass) THEN
 ALTER TABLE "academics"."AcademicIntervention" ADD CONSTRAINT "AcademicIntervention_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_studentId_school_fk' AND conrelid = '"finance"."Invoice"'::regclass) THEN
 ALTER TABLE "finance"."Invoice" ADD CONSTRAINT "Invoice_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_classId_school_fk' AND conrelid = '"finance"."Invoice"'::regclass) THEN
 ALTER TABLE "finance"."Invoice" ADD CONSTRAINT "Invoice_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_academicYearId_school_fk' AND conrelid = '"finance"."Invoice"'::regclass) THEN
 ALTER TABLE "finance"."Invoice" ADD CONSTRAINT "Invoice_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_termId_school_fk' AND conrelid = '"finance"."Invoice"'::regclass) THEN
 ALTER TABLE "finance"."Invoice" ADD CONSTRAINT "Invoice_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_studentId_school_fk' AND conrelid = '"finance"."Payment"'::regclass) THEN
 ALTER TABLE "finance"."Payment" ADD CONSTRAINT "Payment_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_invoiceId_school_fk' AND conrelid = '"finance"."Payment"'::regclass) THEN
 ALTER TABLE "finance"."Payment" ADD CONSTRAINT "Payment_invoiceId_school_fk" FOREIGN KEY ("invoiceId", "schoolId") REFERENCES "finance"."Invoice"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_studentId_school_fk' AND conrelid = '"finance"."Receipt"'::regclass) THEN
 ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_classId_school_fk' AND conrelid = '"finance"."Receipt"'::regclass) THEN
 ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_academicYearId_school_fk' AND conrelid = '"finance"."Receipt"'::regclass) THEN
 ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_termId_school_fk' AND conrelid = '"finance"."Receipt"'::regclass) THEN
 ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_paymentId_school_fk' AND conrelid = '"finance"."Receipt"'::regclass) THEN
 ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_paymentId_school_fk" FOREIGN KEY ("paymentId", "schoolId") REFERENCES "finance"."Payment"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Receipt_invoiceId_school_fk' AND conrelid = '"finance"."Receipt"'::regclass) THEN
 ALTER TABLE "finance"."Receipt" ADD CONSTRAINT "Receipt_invoiceId_school_fk" FOREIGN KEY ("invoiceId", "schoolId") REFERENCES "finance"."Invoice"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentGroupMembership_studentId_school_fk' AND conrelid = '"finance"."StudentGroupMembership"'::regclass) THEN
 ALTER TABLE "finance"."StudentGroupMembership" ADD CONSTRAINT "StudentGroupMembership_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentGroupMembership_groupId_school_fk' AND conrelid = '"finance"."StudentGroupMembership"'::regclass) THEN
 ALTER TABLE "finance"."StudentGroupMembership" ADD CONSTRAINT "StudentGroupMembership_groupId_school_fk" FOREIGN KEY ("groupId", "schoolId") REFERENCES "finance"."StudentGroup"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_classId_school_fk' AND conrelid = '"finance"."FeeStructure"'::regclass) THEN
 ALTER TABLE "finance"."FeeStructure" ADD CONSTRAINT "FeeStructure_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_academicYearId_school_fk' AND conrelid = '"finance"."FeeStructure"'::regclass) THEN
 ALTER TABLE "finance"."FeeStructure" ADD CONSTRAINT "FeeStructure_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_termId_school_fk' AND conrelid = '"finance"."FeeStructure"'::regclass) THEN
 ALTER TABLE "finance"."FeeStructure" ADD CONSTRAINT "FeeStructure_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeStructure_feeCategoryId_school_fk' AND conrelid = '"finance"."FeeStructure"'::regclass) THEN
 ALTER TABLE "finance"."FeeStructure" ADD CONSTRAINT "FeeStructure_feeCategoryId_school_fk" FOREIGN KEY ("feeCategoryId", "schoolId") REFERENCES "finance"."FeeCategory"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentFeeAssignment_studentId_school_fk' AND conrelid = '"finance"."StudentFeeAssignment"'::regclass) THEN
 ALTER TABLE "finance"."StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentFeeAssignment_academicYearId_school_fk' AND conrelid = '"finance"."StudentFeeAssignment"'::regclass) THEN
 ALTER TABLE "finance"."StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentFeeAssignment_termId_school_fk' AND conrelid = '"finance"."StudentFeeAssignment"'::regclass) THEN
 ALTER TABLE "finance"."StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentFeeAssignment_feeCategoryId_school_fk' AND conrelid = '"finance"."StudentFeeAssignment"'::regclass) THEN
 ALTER TABLE "finance"."StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_feeCategoryId_school_fk" FOREIGN KEY ("feeCategoryId", "schoolId") REFERENCES "finance"."FeeCategory"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceLineItem_invoiceId_school_fk' AND conrelid = '"finance"."InvoiceLineItem"'::regclass) THEN
 ALTER TABLE "finance"."InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_school_fk" FOREIGN KEY ("invoiceId", "schoolId") REFERENCES "finance"."Invoice"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceLineItem_feeStructureId_school_fk' AND conrelid = '"finance"."InvoiceLineItem"'::regclass) THEN
 ALTER TABLE "finance"."InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_feeStructureId_school_fk" FOREIGN KEY ("feeStructureId", "schoolId") REFERENCES "finance"."FeeStructure"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceLineItem_feeCategoryId_school_fk' AND conrelid = '"finance"."InvoiceLineItem"'::regclass) THEN
 ALTER TABLE "finance"."InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_feeCategoryId_school_fk" FOREIGN KEY ("feeCategoryId", "schoolId") REFERENCES "finance"."FeeCategory"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManualPaymentApproval_paymentId_school_fk' AND conrelid = '"finance"."ManualPaymentApproval"'::regclass) THEN
 ALTER TABLE "finance"."ManualPaymentApproval" ADD CONSTRAINT "ManualPaymentApproval_paymentId_school_fk" FOREIGN KEY ("paymentId", "schoolId") REFERENCES "finance"."Payment"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Asset_parentAssetId_school_fk' AND conrelid = '"finance"."Asset"'::regclass) THEN
 ALTER TABLE "finance"."Asset" ADD CONSTRAINT "Asset_parentAssetId_school_fk" FOREIGN KEY ("parentAssetId", "schoolId") REFERENCES "finance"."Asset"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FundRequestEvent_fundRequestId_school_fk' AND conrelid = '"finance"."FundRequestEvent"'::regclass) THEN
 ALTER TABLE "finance"."FundRequestEvent" ADD CONSTRAINT "FundRequestEvent_fundRequestId_school_fk" FOREIGN KEY ("fundRequestId", "schoolId") REFERENCES "finance"."FundRequest"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreMovement_storeItemId_school_fk' AND conrelid = '"finance"."StoreMovement"'::regclass) THEN
 ALTER TABLE "finance"."StoreMovement" ADD CONSTRAINT "StoreMovement_storeItemId_school_fk" FOREIGN KEY ("storeItemId", "schoolId") REFERENCES "finance"."StoreItem"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradingScale_academicYearId_school_fk' AND conrelid = '"academics"."GradingScale"'::regclass) THEN
 ALTER TABLE "academics"."GradingScale" ADD CONSTRAINT "GradingScale_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradingScale_subjectId_school_fk' AND conrelid = '"academics"."GradingScale"'::regclass) THEN
 ALTER TABLE "academics"."GradingScale" ADD CONSTRAINT "GradingScale_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GradeBoundary_gradingScaleId_school_fk' AND conrelid = '"academics"."GradeBoundary"'::regclass) THEN
 ALTER TABLE "academics"."GradeBoundary" ADD CONSTRAINT "GradeBoundary_gradingScaleId_school_fk" FOREIGN KEY ("gradingScaleId", "schoolId") REFERENCES "academics"."GradingScale"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssessmentType_academicYearId_school_fk' AND conrelid = '"academics"."AssessmentType"'::regclass) THEN
 ALTER TABLE "academics"."AssessmentType" ADD CONSTRAINT "AssessmentType_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssessmentType_subjectId_school_fk' AND conrelid = '"academics"."AssessmentType"'::regclass) THEN
 ALTER TABLE "academics"."AssessmentType" ADD CONSTRAINT "AssessmentType_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mark_studentId_school_fk' AND conrelid = '"academics"."Mark"'::regclass) THEN
 ALTER TABLE "academics"."Mark" ADD CONSTRAINT "Mark_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mark_classSubjectId_school_fk' AND conrelid = '"academics"."Mark"'::regclass) THEN
 ALTER TABLE "academics"."Mark" ADD CONSTRAINT "Mark_classSubjectId_school_fk" FOREIGN KEY ("classSubjectId", "schoolId") REFERENCES "academics"."ClassSubject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mark_assessmentId_school_fk' AND conrelid = '"academics"."Mark"'::regclass) THEN
 ALTER TABLE "academics"."Mark" ADD CONSTRAINT "Mark_assessmentId_school_fk" FOREIGN KEY ("assessmentId", "schoolId") REFERENCES "academics"."Assessment"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubjectCombination_academicYearId_school_fk' AND conrelid = '"academics"."SubjectCombination"'::regclass) THEN
 ALTER TABLE "academics"."SubjectCombination" ADD CONSTRAINT "SubjectCombination_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubjectCombinationSubject_subjectId_school_fk' AND conrelid = '"academics"."SubjectCombinationSubject"'::regclass) THEN
 ALTER TABLE "academics"."SubjectCombinationSubject" ADD CONSTRAINT "SubjectCombinationSubject_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubjectCombinationSubject_combinationId_school_fk' AND conrelid = '"academics"."SubjectCombinationSubject"'::regclass) THEN
 ALTER TABLE "academics"."SubjectCombinationSubject" ADD CONSTRAINT "SubjectCombinationSubject_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubjectEnrollment_studentId_school_fk' AND conrelid = '"academics"."StudentSubjectEnrollment"'::regclass) THEN
 ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_studentId_school_fk" FOREIGN KEY ("studentId", "schoolId") REFERENCES "students"."Student"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubjectEnrollment_classId_school_fk' AND conrelid = '"academics"."StudentSubjectEnrollment"'::regclass) THEN
 ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubjectEnrollment_academicYearId_school_fk' AND conrelid = '"academics"."StudentSubjectEnrollment"'::regclass) THEN
 ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubjectEnrollment_termId_school_fk' AND conrelid = '"academics"."StudentSubjectEnrollment"'::regclass) THEN
 ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubjectEnrollment_subjectId_school_fk' AND conrelid = '"academics"."StudentSubjectEnrollment"'::regclass) THEN
 ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentSubjectEnrollment_combinationId_school_fk' AND conrelid = '"academics"."StudentSubjectEnrollment"'::regclass) THEN
 ALTER TABLE "academics"."StudentSubjectEnrollment" ADD CONSTRAINT "StudentSubjectEnrollment_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApprovalLog_assessmentId_school_fk' AND conrelid = '"academics"."ApprovalLog"'::regclass) THEN
 ALTER TABLE "academics"."ApprovalLog" ADD CONSTRAINT "ApprovalLog_assessmentId_school_fk" FOREIGN KEY ("assessmentId", "schoolId") REFERENCES "academics"."Assessment"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Timetable_classId_school_fk' AND conrelid = '"academics"."Timetable"'::regclass) THEN
 ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Timetable_academicYearId_school_fk' AND conrelid = '"academics"."Timetable"'::regclass) THEN
 ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Timetable_termId_school_fk' AND conrelid = '"academics"."Timetable"'::regclass) THEN
 ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Timetable_subjectId_school_fk' AND conrelid = '"academics"."Timetable"'::regclass) THEN
 ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Timetable_teacherId_school_fk' AND conrelid = '"academics"."Timetable"'::regclass) THEN
 ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_teacherId_school_fk" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Timetable_combinationId_school_fk' AND conrelid = '"academics"."Timetable"'::regclass) THEN
 ALTER TABLE "academics"."Timetable" ADD CONSTRAINT "Timetable_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSheet_classId_school_fk' AND conrelid = '"academics"."TimetableSheet"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSheet" ADD CONSTRAINT "TimetableSheet_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSheet_academicYearId_school_fk' AND conrelid = '"academics"."TimetableSheet"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSheet" ADD CONSTRAINT "TimetableSheet_academicYearId_school_fk" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "students"."AcademicYear"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSheet_termId_school_fk' AND conrelid = '"academics"."TimetableSheet"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSheet" ADD CONSTRAINT "TimetableSheet_termId_school_fk" FOREIGN KEY ("termId", "schoolId") REFERENCES "students"."Term"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_classId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_classId_school_fk" FOREIGN KEY ("classId", "schoolId") REFERENCES "students"."Class"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_subjectId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_school_fk" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "academics"."Subject"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_teacherId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_school_fk" FOREIGN KEY ("teacherId", "schoolId") REFERENCES "auth"."users"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_combinationId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_combinationId_school_fk" FOREIGN KEY ("combinationId", "schoolId") REFERENCES "academics"."SubjectCombination"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_sheetId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_sheetId_school_fk" FOREIGN KEY ("sheetId", "schoolId") REFERENCES "academics"."TimetableSheet"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_activityId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_activityId_school_fk" FOREIGN KEY ("activityId", "schoolId") REFERENCES "academics"."TimetableActivity"("id", "schoolId") NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimetableSlot_venueId_school_fk' AND conrelid = '"academics"."TimetableSlot"'::regclass) THEN
 ALTER TABLE "academics"."TimetableSlot" ADD CONSTRAINT "TimetableSlot_venueId_school_fk" FOREIGN KEY ("venueId", "schoolId") REFERENCES "academics"."Venue"("id", "schoolId") NOT VALID;
 END IF;
END $$;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Student_authUserId_school_fk' AND conrelid = 'students."Student"'::regclass) THEN
 ALTER TABLE students."Student" ADD CONSTRAINT "Student_authUserId_school_fk" FOREIGN KEY ("authUserId", "schoolId") REFERENCES auth.users(id, "schoolId") NOT VALID;
 END IF;
END $$;
