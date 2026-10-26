-- Stories: a photo (with an optional caption) visible to your connections and followers for 24 hours.
--   • stories: one new table. expiresAt defaults to 24 hours after the row is created.
--   • story_views: one new table — who has seen which story (once per viewer and story).
-- Nothing existing is changed. Every statement is guarded, so running this file a second time changes nothing.

-- CreateTable
CREATE TABLE IF NOT EXISTS "stories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "text" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '24:00:00'::interval),

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "story_views" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stories_userId_expiresAt_idx" ON "stories"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "stories_expiresAt_idx" ON "stories"("expiresAt");
CREATE INDEX IF NOT EXISTS "story_views_viewerId_idx" ON "story_views"("viewerId");
CREATE UNIQUE INDEX IF NOT EXISTS "story_views_storyId_viewerId_key" ON "story_views"("storyId", "viewerId");

-- AddForeignKey (a member's stories and their views go when the member or the story is deleted)
DO $$ BEGIN
  ALTER TABLE "stories" ADD CONSTRAINT "stories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "story_views" ADD CONSTRAINT "story_views_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
