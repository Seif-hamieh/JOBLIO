-- Post drafts: unpublished posts, in their own table so they can never show in feeds, profiles or counts.
--   • post_drafts: one new table. Nothing existing is changed.
-- Every statement is guarded, so running this file a second time changes nothing.

-- CreateTable
CREATE TABLE IF NOT EXISTS "post_drafts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "type" "PostType" NOT NULL DEFAULT 'UPDATE',
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
    "asCompany" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "projectId" TEXT,
    "mediaUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "post_drafts_authorId_updatedAt_idx" ON "post_drafts"("authorId", "updatedAt" DESC);

-- AddForeignKey (a member's drafts go when the member is deleted)
DO $$ BEGIN
  ALTER TABLE "post_drafts" ADD CONSTRAINT "post_drafts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
