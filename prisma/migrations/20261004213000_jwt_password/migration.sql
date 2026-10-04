-- Drop Better Auth tables
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "Verification";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "User" DROP COLUMN IF EXISTS "image";
ALTER TABLE "User" ADD COLUMN "password" TEXT;
