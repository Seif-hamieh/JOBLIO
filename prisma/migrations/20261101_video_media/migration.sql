-- Videos in posts and stories. Safe to run again: each step is skipped when it is already done.
DO $$ BEGIN
  CREATE TYPE "PostMediaType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "mediaType" "PostMediaType" NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "mediaType" "PostMediaType" NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
