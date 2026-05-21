-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateEnum
CREATE TYPE "notifications"."NotificationChannel" AS ENUM ('SMS', 'EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "notifications"."NotificationStatus" AS ENUM ('QUEUED', 'SENDING', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notifications"."AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "notifications"."AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notifications"."DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "notifications"."NotificationTemplate" (    "id" TEXT NOT NULL,    "eventType" TEXT NOT NULL,    "channel" "notifications"."NotificationChannel" NOT NULL,    "name" TEXT NOT NULL,    "subject" TEXT,    "body" TEXT NOT NULL,    "smsBody" TEXT,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "language" TEXT NOT NULL DEFAULT 'en',    "variables" JSONB NOT NULL,    "createdById" TEXT NOT NULL,    "updatedById" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."Notification" (    "id" TEXT NOT NULL,    "recipientId" TEXT NOT NULL,    "recipientRole" TEXT NOT NULL,    "recipientPhone" TEXT,    "recipientEmail" TEXT,    "channel" "notifications"."NotificationChannel" NOT NULL,    "eventType" TEXT NOT NULL,    "templateId" TEXT,    "subject" TEXT,    "body" TEXT NOT NULL,    "status" "notifications"."NotificationStatus" NOT NULL DEFAULT 'QUEUED',    "attemptCount" INTEGER NOT NULL DEFAULT 0,    "lastAttemptAt" TIMESTAMP(3),    "deliveredAt" TIMESTAMP(3),    "failureReason" TEXT,    "externalMessageId" TEXT,    "metadata" JSONB,    "isRead" BOOLEAN NOT NULL DEFAULT false,    "readAt" TIMESTAMP(3),    "sourceService" TEXT NOT NULL,    "sourceEventId" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."Announcement" (    "id" TEXT NOT NULL,    "title" TEXT NOT NULL,    "body" TEXT NOT NULL,    "authorId" TEXT NOT NULL,    "authorRole" TEXT NOT NULL,    "targetRoles" TEXT[],    "targetClassIds" TEXT[],    "channels" "notifications"."NotificationChannel"[],    "priority" "notifications"."AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',    "status" "notifications"."AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',    "scheduledAt" TIMESTAMP(3),    "publishedAt" TIMESTAMP(3),    "expiresAt" TIMESTAMP(3),    "attachmentUrl" TEXT,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."DeviceToken" (    "id" TEXT NOT NULL,    "userId" TEXT NOT NULL,    "token" TEXT NOT NULL,    "platform" "notifications"."DevicePlatform" NOT NULL,    "deviceInfo" TEXT,    "isActive" BOOLEAN NOT NULL DEFAULT true,    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."NotificationPreference" (    "id" TEXT NOT NULL,    "userId" TEXT NOT NULL,    "eventType" TEXT NOT NULL,    "channel" "notifications"."NotificationChannel" NOT NULL,    "isEnabled" BOOLEAN NOT NULL DEFAULT true,    "updatedAt" TIMESTAMP(3) NOT NULL,    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"));

-- CreateTable
CREATE TABLE "notifications"."SmsDeliveryLog" (    "id" TEXT NOT NULL,    "notificationId" TEXT NOT NULL,    "provider" TEXT NOT NULL,    "phoneNumber" TEXT NOT NULL,    "messageBody" TEXT NOT NULL,    "requestPayload" JSONB NOT NULL,    "responsePayload" JSONB,    "success" BOOLEAN NOT NULL,    "externalMessageId" TEXT,    "cost" TEXT,    "failureReason" TEXT,    "attemptNumber" INTEGER NOT NULL,    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,    CONSTRAINT "SmsDeliveryLog_pkey" PRIMARY KEY ("id"));

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_eventType_channel_language_key" ON "notifications"."NotificationTemplate"("eventType", "channel", "language");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_idx" ON "notifications"."Notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_status_channel_idx" ON "notifications"."Notification"("status", "channel");

-- CreateIndex
CREATE INDEX "Notification_eventType_createdAt_idx" ON "notifications"."Notification"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_sourceEventId_idx" ON "notifications"."Notification"("sourceEventId");

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledAt_idx" ON "notifications"."Announcement"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "notifications"."DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_isActive_idx" ON "notifications"."DeviceToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "notifications"."NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_eventType_channel_key" ON "notifications"."NotificationPreference"("userId", "eventType", "channel");

-- CreateIndex
CREATE INDEX "SmsDeliveryLog_notificationId_idx" ON "notifications"."SmsDeliveryLog"("notificationId");

-- CreateIndex
CREATE INDEX "SmsDeliveryLog_sentAt_idx" ON "notifications"."SmsDeliveryLog"("sentAt");

-- AddForeignKey
ALTER TABLE "notifications"."Notification" ADD CONSTRAINT "Notification_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notifications"."NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"."SmsDeliveryLog" ADD CONSTRAINT "SmsDeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"."Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;