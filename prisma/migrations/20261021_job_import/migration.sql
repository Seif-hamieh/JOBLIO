-- Job import (Arbeitnow, Jobicy, Himalayas): additive only — nothing is dropped, renamed or rewritten.
-- Every statement is guarded, so running this file a second time changes nothing.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JobSource" AS ENUM ('ARBEITNOW', 'JOBICY', 'HIMALAYAS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: companies created by the import (NULL for every existing company)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "importSource" "JobSource";

-- AlterTable: where an imported job came from (NULL for every existing job)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "externalSource" "JobSource";
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;

-- CreateIndex: one row per imported listing (NULLs don't collide, so existing jobs are unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_externalSource_externalId_key" ON "jobs"("externalSource", "externalId");
