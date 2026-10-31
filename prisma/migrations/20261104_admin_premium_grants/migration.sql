-- Premium given by an admin without a payment: who gave it (null = bought). Safe to run again.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grantedById" TEXT;
ALTER TABLE "profile_boosts" ADD COLUMN IF NOT EXISTS "grantedById" TEXT;
ALTER TABLE "job_promotions" ADD COLUMN IF NOT EXISTS "grantedById" TEXT;
