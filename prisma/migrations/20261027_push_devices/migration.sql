-- Phone push notifications.
--   • user_settings: one new column, pushNotifications (on by default — existing members keep getting what they
--     already chose, now on their phone too). No existing value is changed.
--   • push_devices: one new table — the phones that can receive notifications (one row per device).
-- Every statement is guarded, so running this file a second time changes nothing.

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "pushNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "push_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX IF NOT EXISTS "push_devices_userId_idx" ON "push_devices"("userId");

-- AddForeignKey (a member's devices go when the member is deleted)
DO $$ BEGIN
  ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
