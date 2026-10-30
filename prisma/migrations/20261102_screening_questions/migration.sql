-- Screening questions on jobs, the answers on applications, and members' phone numbers. Safe to run again: each
-- step is skipped when it is already done.
DO $$ BEGIN
  CREATE TYPE "ScreeningQuestionType" AS ENUM ('TEXT', 'YES_NO', 'NUMBER', 'MULTIPLE_CHOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "screening_questions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "questionText" VARCHAR(300) NOT NULL,
    "type" "ScreeningQuestionType" NOT NULL,
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "screening_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "screening_questions_jobId_position_idx" ON "screening_questions"("jobId", "position");
DO $$ BEGIN
  ALTER TABLE "screening_questions" ADD CONSTRAINT "screening_questions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "screeningAnswers" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR(32);
