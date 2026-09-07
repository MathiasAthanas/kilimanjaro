DROP INDEX IF EXISTS notifications."NotificationTemplate_eventType_channel_language_key";
CREATE UNIQUE INDEX "NotificationTemplate_schoolId_eventType_channel_language_key" ON notifications."NotificationTemplate"("schoolId","eventType","channel","language");
