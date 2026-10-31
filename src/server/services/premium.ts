import "server-only";
import { db, type Prisma } from "@/server/db";

// Who shows the 👑 crown: members with an active premium plan (Job Seeker Pro, Recruiter Pro, Premium Portfolio —
// bought or given by an admin) or an active Profile Boost. Checked when the page loads, so a grant or a revoke
// shows (or hides) the crown on the next page or screen.

const PLANS = ["JOB_SEEKER_PRO", "RECRUITER_PRO", "PREMIUM_PORTFOLIO"] as const;

const activePlan = (now: Date): Prisma.SubscriptionWhereInput => ({
  product: { in: [...PLANS] },
  status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
  currentPeriodEnd: { gt: now },
});

/** Which of these members are premium now (one query for a whole list). */
export async function premiumUserIds(ids: (string | null | undefined)[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return new Set();
  const now = new Date();
  const rows = await db.user.findMany({
    where: { id: { in: unique }, OR: [{ subscriptions: { some: activePlan(now) } }, { profile: { featuredUntil: { gt: now } } }] },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export async function isPremiumUser(id: string) {
  return (await premiumUserIds([id])).has(id);
}

/**
 * The member's own premium features for Settings: each active plan or boost with its end date (and whether the
 * Joblio team gave it), the company page plan, and Priority Application credits.
 */
export async function myPremiumFeatures(userId: string) {
  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      priorityCredits: true,
      profile: { select: { featuredUntil: true } },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: now } },
        orderBy: { currentPeriodEnd: "desc" },
        select: { product: true, currentPeriodEnd: true, grantedById: true, cancelAtPeriodEnd: true },
      },
    },
  });
  if (!user) return { features: [], priorityCredits: 0 };
  const features: { product: string; until: Date; gift: boolean; renews: boolean }[] = [];
  for (const s of user.subscriptions) {
    if (features.some((f) => f.product === s.product)) continue;
    features.push({ product: s.product, until: s.currentPeriodEnd, gift: !!s.grantedById, renews: !s.grantedById && !s.cancelAtPeriodEnd });
  }
  if (user.profile?.featuredUntil && user.profile.featuredUntil > now) {
    const boost = await db.profileBoost.findFirst({ where: { userId, endsAt: { gt: now } }, orderBy: { endsAt: "desc" }, select: { grantedById: true } });
    features.push({ product: "PROFILE_BOOST", until: user.profile.featuredUntil, gift: !!boost?.grantedById, renews: false });
  }
  return { features, priorityCredits: user.priorityCredits };
}
export type MyPremium = Awaited<ReturnType<typeof myPremiumFeatures>>;
