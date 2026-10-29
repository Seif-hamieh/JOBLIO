-- Chat media: voice messages, images and shared locations.
--   • MessageKind: three new values (IMAGE, AUDIO, LOCATION). Existing values are unchanged.
--   • messages: two new optional columns (latitude, longitude). Existing rows are untouched.
-- Every statement is guarded, so running this file a second time changes nothing.

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'AUDIO';
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'LOCATION';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
