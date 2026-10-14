import "server-only";
import { db } from "@/server/db";

/** One free 7-day Profile Boost per 30 days for Job Seeker Pro members. */
export const FREE_BOOST_DAYS = 7;
export const FREE_BOOST_INTERVAL_DAYS = 30;
const DAY = 86_400_000;

/** An active (paid, not expired) Job Seeker Pro subscription. */
export async function hasJobSeekerPro(userId: string): Promise<boolean> {
  const sub = await db.subscription.findFirst({
    where: { userId, product: "JOB_SEEKER_PRO", status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    select: { id: true },
  });
  return !!sub;
}

export async function isEligibleForFreeBoost(userId: string): Promise<{
  eligible: boolean;
  reason?: "no_subscription" | "too_soon" | "already_active";
  nextEligibleAt?: Date;
}> {
  if (!(await hasJobSeekerPro(userId))) return { eligible: false, reason: "no_subscription" };

  const user = await db.user.findUnique({ where: { id: userId }, select: { lastFreeBoostClaimedAt: true, profile: { select: { featuredUntil: true } } } });
  const now = Date.now();
  if (user?.lastFreeBoostClaimedAt) {
    const nextEligibleAt = new Date(user.lastFreeBoostClaimedAt.getTime() + FREE_BOOST_INTERVAL_DAYS * DAY);
    if (nextEligibleAt.getTime() > now) return { eligible: false, reason: "too_soon", nextEligibleAt };
  }
  if (user?.profile?.featuredUntil && user.profile.featuredUntil.getTime() > now) return { eligible: false, reason: "already_active" };
  return { eligible: true };
}
