-- CV builder: one row per member with what goes on their generated CV.
--   • resume_data: one new table. Nothing existing is changed.
-- Every statement is guarded, so running this file a second time changes nothing.

-- CreateTable
CREATE TABLE IF NOT EXISTS "resume_data" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "summary" TEXT,
    "experience" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "skills" TEXT[],
    "languages" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "resume_data_userId_key" ON "resume_data"("userId");

-- AddForeignKey (a member's CV data goes when the member is deleted)
DO $$ BEGIN
  ALTER TABLE "resume_data" ADD CONSTRAINT "resume_data_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
