-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "bodyKey" VARCHAR(60),
ADD COLUMN     "titleKey" VARCHAR(60),
ADD COLUMN     "vars" JSONB;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "locale" VARCHAR(8) NOT NULL DEFAULT 'en';
