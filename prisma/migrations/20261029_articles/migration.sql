-- Articles: long-form posts with a title, cover image and text, saved as drafts or published.
--   • ArticleStatus: one new enum. • articles: one new table. Nothing existing is changed.
-- Every statement is guarded, so running this file a second time changes nothing.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "articles" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "articles_authorId_status_publishedAt_idx" ON "articles"("authorId", "status", "publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt" DESC);

-- AddForeignKey (a member's articles go when the member is deleted)
DO $$ BEGIN
  ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
