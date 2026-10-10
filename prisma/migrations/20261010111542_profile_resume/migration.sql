-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "resumeName" VARCHAR(120),
ADD COLUMN     "resumeUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "resumeUrl" TEXT;
