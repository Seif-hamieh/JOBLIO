-- Job reports ("Report job" button): one new table — no existing table or row is changed.
-- Every statement is guarded, so running this file a second time changes nothing.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "JobReportReason" AS ENUM ('FAKE', 'SCAM', 'SPAM', 'OFFENSIVE', 'EXPIRED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobReportStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reporterKey" VARCHAR(64) NOT NULL,
    "reason" "JobReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "status" "JobReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "job_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_reports_status_createdAt_idx" ON "job_reports"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "job_reports_jobId_reporterKey_idx" ON "job_reports"("jobId", "reporterKey");

-- AddForeignKey (a report disappears with its job; a deleted member's reports stay, without the name)
DO $$ BEGIN
  ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
