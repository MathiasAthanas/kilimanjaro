-- Additive backfill; application middleware sets schoolId on every new write.
ALTER TABLE "notifications"."NotificationTemplate" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "NotificationTemplate_schoolId_idx" ON "notifications"."NotificationTemplate"("schoolId");
ALTER TABLE "notifications"."Notification" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "Notification_schoolId_idx" ON "notifications"."Notification"("schoolId");
ALTER TABLE "notifications"."Announcement" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "Announcement_schoolId_idx" ON "notifications"."Announcement"("schoolId");
ALTER TABLE "notifications"."DeviceToken" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "DeviceToken_schoolId_idx" ON "notifications"."DeviceToken"("schoolId");
ALTER TABLE "notifications"."NotificationPreference" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "NotificationPreference_schoolId_idx" ON "notifications"."NotificationPreference"("schoolId");
ALTER TABLE "notifications"."SmsDeliveryLog" ADD COLUMN "schoolId" TEXT NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';
CREATE INDEX "SmsDeliveryLog_schoolId_idx" ON "notifications"."SmsDeliveryLog"("schoolId");
