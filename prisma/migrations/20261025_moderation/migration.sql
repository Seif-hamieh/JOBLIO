-- Moderation: banning members + "Report post".
--   • users: two new empty columns (bannedAt, bannedReason). No existing value is changed; nobody is banned.
--   • post_reports: one new table.
-- Every statement is guarded, so running this file a second time changes nothing.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PostReportReason" AS ENUM ('SPAM', 'SCAM', 'HARASSMENT', 'HATE', 'INAPPROPRIATE', 'MISINFORMATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostReportStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannedReason" VARCHAR(300);

-- CreateTable
CREATE TABLE IF NOT EXISTS "post_reports" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reason" "PostReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "status" "PostReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "post_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_reports_status_createdAt_idx" ON "post_reports"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "post_reports_postId_reporterId_idx" ON "post_reports"("postId", "reporterId");

-- AddForeignKey (a report disappears with its post; a deleted member's reports stay, without the name)
DO $$ BEGIN
  ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "post_reports" ADD CONSTRAINT "post_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
