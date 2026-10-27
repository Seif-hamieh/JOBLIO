-- Job alerts: saved job searches with alerts on now actually notify their owner about new matching jobs.
--   • NotificationType: one new value, JOB_ALERT.
--   • saved_searches: one new empty column, lastAlertedAt (when the alert was last checked).
-- Nothing existing is changed. Every statement is guarded, so running this file a second time changes nothing.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_ALERT';

-- AlterTable
ALTER TABLE "saved_searches" ADD COLUMN IF NOT EXISTS "lastAlertedAt" TIMESTAMP(3);
