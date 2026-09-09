-- Add the Admissions Officer role to the auth Role enum
ALTER TYPE "auth"."Role" ADD VALUE IF NOT EXISTS 'ADMISSIONS';
