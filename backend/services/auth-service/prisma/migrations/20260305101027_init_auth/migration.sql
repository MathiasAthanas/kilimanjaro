-- CreateEnum
CREATE TYPE "auth"."Role" AS ENUM ('SYSTEM_ADMIN', 'BOARD_DIRECTOR', 'MANAGING_DIRECTOR', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'PARENT', 'STUDENT');

-- CreateEnum
CREATE TYPE "auth"."AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESHED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'USER_CREATED', 'USER_DEACTIVATED', 'USER_ACTIVATED', 'USER_ROLE_CHANGED');

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "registrationNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "auth"."Role" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "auth"."AuditAction" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_registrationNumber_key" ON "auth"."users"("registrationNumber");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "auth"."users"("role", "isActive");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "auth"."users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "auth"."refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_isRevoked_idx" ON "auth"."refresh_tokens"("userId", "isRevoked");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "auth"."refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_isUsed_idx" ON "auth"."password_reset_tokens"("userId", "isUsed");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "auth"."password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "auth"."audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "auth"."audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "auth"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
