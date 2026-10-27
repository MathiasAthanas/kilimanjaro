-- Temporary passwords are encrypted by the auth service and removed as soon
-- as the user chooses a permanent password. Existing password hashes remain
-- unchanged and cannot be reversed.
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS "temporaryPasswordEncrypted" TEXT;
