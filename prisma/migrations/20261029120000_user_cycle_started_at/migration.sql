-- AlterTable: start of the user's current budget cycle (payday).
ALTER TABLE "User" ADD COLUMN "cycleStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing users: cycle starts at the 1st of the current month in America/Bogota.
-- Stored as a UTC wall-clock timestamp, like every other Prisma DateTime column.
UPDATE "User"
SET "cycleStartedAt" = (
  date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')
    AT TIME ZONE 'America/Bogota'
) AT TIME ZONE 'UTC';
