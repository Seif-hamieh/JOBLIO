import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";

// Premium given by an admin, without a payment (while payments are paused, or as a gift). It goes into the same
// rows a purchase fills (Subscription, ProfileBoost + Profile.featuredUntil, User.priorityCredits, Job promotion
// windows), so every premium feature works exactly as if it had been bought. grantedById marks it as an admin
// grant; revoking only ends admin grants, never something a member paid for.

export const PLAN_FEATURES = ["JOB_SEEKER_PRO", "RECRUITER_PRO", "PREMIUM_PORTFOLIO", "COMPANY_PREMIUM"] as const;
export const USER_FEATURES = [...PLAN_FEATURES, "PROFILE_BOOST", "PRIORITY_APPLICATION"] as const;
export type UserFeature = (typeof USER_FEATURES)[number];
export const JOB_PROMOTIONS = ["FEATURED", "URGENT", "SPONSORED"] as const;
export type JobPromotionKind = (typeof JOB_PROMOTIONS)[number];

export const MAX_GRANT_DAYS = 366;
export const MAX_GRANT_CREDITS = 50;

const DAY = 86_400_000;
const later = (a: Date | null | undefined, b: Date) => (a && a > b ? a : b);
const isPlan = (f: UserFeature): f is (typeof PLAN_FEATURES)[number] => (PLAN_FEATURES as readonly string[]).includes(f);

/** Everything premium the member has now: each plan (until when, and whether an admin gave it), boost, credits. */
export async function getPremiumStatus(userId: string) {
  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      username: true,
      priorityCredits: true,
      profile: { select: { featuredUntil: true } },
      companyMemberships: { select: { company: { select: { id: true, name: true, premiumUntil: true } } }, take: 1 },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: now } },
        select: { product: true, currentPeriodEnd: true, grantedById: true },
        orderBy: { currentPeriodEnd: "desc" },
      },
    },
  });
  if (!user) throw new ActionError(k("admin.msg.userNotFound"));
  const company = user.companyMemberships[0]?.company ?? null;
  const plan = (product: (typeof PLAN_FEATURES)[number]) => {
    const subs = user.subscriptions.filter((s) => s.product === product);
    const until = product === "COMPANY_PREMIUM" ? later(subs[0]?.currentPeriodEnd, company?.premiumUntil && company.premiumUntil > now ? company.premiumUntil : new Date(0)) : subs[0]?.currentPeriodEnd;
    const active = !!until && until > now;
    return { active, until: active ? until! : null, granted: subs.some((s) => s.grantedById), paid: subs.some((s) => !s.grantedById) };
  };
  const boostUntil = user.profile?.featuredUntil && user.profile.featuredUntil > now ? user.profile.featuredUntil : null;
  return {
    user: { id: user.id, name: user.name, email: user.email, image: user.image, username: user.username },
    company: company && { id: company.id, name: company.name },
    hasProfile: !!user.profile,
    plans: {
      JOB_SEEKER_PRO: plan("JOB_SEEKER_PRO"),
      RECRUITER_PRO: plan("RECRUITER_PRO"),
      PREMIUM_PORTFOLIO: plan("PREMIUM_PORTFOLIO"),
      COMPANY_PREMIUM: plan("COMPANY_PREMIUM"),
    },
    profileBoost: { active: !!boostUntil, until: boostUntil },
    priorityCredits: user.priorityCredits,
  };
}
export type PremiumStatus = Awaited<ReturnType<typeof getPremiumStatus>>;

/**
 * Gives the member a feature: a plan or a Profile Boost for `days` (added on top of what's left), or `credits`
 * Priority Applications. The member gets a notification.
 */
export async function grantPremiumAsAdmin(adminId: string, userId: string, feature: UserFeature, amount: number) {
  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, profile: { select: { featuredUntil: true } }, companyMemberships: { select: { companyId: true }, take: 1 } },
  });
  if (!user) throw new ActionError(k("admin.msg.userNotFound"));
  const companyId = user.companyMemberships[0]?.companyId ?? null;

  if (feature === "PRIORITY_APPLICATION") {
    const credits = Math.trunc(amount);
    if (credits < 1 || credits > MAX_GRANT_CREDITS) throw new ActionError(k("admin.premium.badCredits", { n: MAX_GRANT_CREDITS }));
    await db.user.update({ where: { id: userId }, data: { priorityCredits: { increment: credits } } });
  } else {
    const days = Math.trunc(amount);
    if (days < 1 || days > MAX_GRANT_DAYS) throw new ActionError(k("admin.premium.badDays", { n: MAX_GRANT_DAYS }));
    if (feature === "PROFILE_BOOST") {
      if (!user.profile) throw new ActionError(k("admin.premium.noProfile"));
      const start = later(user.profile.featuredUntil, now);
      const endsAt = new Date(start.getTime() + days * DAY);
      await db.$transaction([
        db.profileBoost.create({ data: { userId, product: "PROFILE_BOOST", startsAt: start, endsAt, grantedById: adminId } }),
        db.profile.update({ where: { userId }, data: { featuredUntil: endsAt, openToWork: true } }),
      ]);
    } else {
      if (feature === "COMPANY_PREMIUM" && !companyId) throw new ActionError(k("admin.premium.noCompany"));
      // One admin-given row per plan, extended on each grant.
      const existing = await db.subscription.findFirst({
        where: { userId, product: feature, grantedById: { not: null }, status: "ACTIVE" },
        orderBy: { currentPeriodEnd: "desc" },
      });
      const end = new Date(later(existing?.currentPeriodEnd, now).getTime() + days * DAY);
      await db.$transaction(async (tx) => {
        if (existing) await tx.subscription.update({ where: { id: existing.id }, data: { currentPeriodEnd: end, cancelAtPeriodEnd: true, grantedById: adminId } });
        else
          await tx.subscription.create({
            data: {
              userId,
              companyId: feature === "COMPANY_PREMIUM" ? companyId : null,
              product: feature,
              status: "ACTIVE",
              currentPeriodEnd: end,
              // Nothing renews it: it simply ends.
              cancelAtPeriodEnd: true,
              grantedById: adminId,
            },
          });
        if (feature === "COMPANY_PREMIUM") {
          const c = await tx.company.findUniqueOrThrow({ where: { id: companyId! }, select: { premiumUntil: true } });
          await tx.company.update({ where: { id: companyId! }, data: { premiumUntil: later(c.premiumUntil, end) } });
        }
      });
    }
  }

  await notify({
    userId,
    actorId: adminId,
    type: "BILLING",
    title: k("notif.premiumGift", { product: `@premium.products.${feature}.name` }),
    body: k("notif.premiumGiftBody"),
    href: "/settings/billing",
  });
  revalidatePath("/admin/users");
  return k("admin.premium.granted");
}

/** Ends what an admin gave: the plan, the boost (now), or the unused Priority Application credits. */
export async function revokePremiumAsAdmin(userId: string, feature: UserFeature) {
  const now = new Date();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, companyMemberships: { select: { companyId: true }, take: 1 } } });
  if (!user) throw new ActionError(k("admin.msg.userNotFound"));

  if (feature === "PRIORITY_APPLICATION") {
    await db.user.update({ where: { id: userId }, data: { priorityCredits: 0 } });
  } else if (feature === "PROFILE_BOOST") {
    const granted = await db.profileBoost.findMany({ where: { userId, endsAt: { gt: now } }, select: { grantedById: true, paymentId: true } });
    if (granted.some((b) => !b.grantedById && b.paymentId)) throw new ActionError(k("admin.premium.paid"));
    await db.$transaction([
      db.profileBoost.updateMany({ where: { userId, endsAt: { gt: now } }, data: { endsAt: now } }),
      db.profile.updateMany({ where: { userId }, data: { featuredUntil: null } }),
    ]);
  } else if (isPlan(feature)) {
    const { count } = await db.subscription.updateMany({
      where: { userId, product: feature, grantedById: { not: null }, status: "ACTIVE", currentPeriodEnd: { gt: now } },
      data: { status: "CANCELED", currentPeriodEnd: now },
    });
    if (!count) throw new ActionError(k("admin.premium.nothingGranted"));
    const companyId = user.companyMemberships[0]?.companyId;
    if (feature === "COMPANY_PREMIUM" && companyId) {
      // The company keeps premium only as long as a paid subscription still covers it.
      const paid = await db.subscription.findFirst({
        where: { companyId, product: "COMPANY_PREMIUM", status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: now } },
        orderBy: { currentPeriodEnd: "desc" },
        select: { currentPeriodEnd: true },
      });
      await db.company.update({ where: { id: companyId }, data: { premiumUntil: paid?.currentPeriodEnd ?? null } });
    }
  }
  revalidatePath("/admin/users");
  return k("admin.premium.revoked");
}

/** Turns a job's Featured, Urgent or Sponsored window on for `days` (on top of what's left), or off with 0. */
export async function setJobPromotionAsAdmin(adminId: string, jobId: string, kind: JobPromotionKind, days: number) {
  const now = new Date();
  const field = kind === "FEATURED" ? "featuredUntil" : kind === "URGENT" ? "urgentUntil" : "sponsoredUntil";
  const job = await db.job.findUnique({ where: { id: jobId }, select: { id: true, status: true, featuredUntil: true, urgentUntil: true, sponsoredUntil: true } });
  if (!job) throw new ActionError(k("admin.premium.jobNotFound"));
  const d = Math.trunc(days);
  if (d === 0) {
    await db.$transaction([
      db.jobPromotion.updateMany({ where: { jobId, kind, endsAt: { gt: now } }, data: { endsAt: now } }),
      db.job.update({ where: { id: jobId }, data: { [field]: null } }),
    ]);
  } else {
    if (d < 1 || d > MAX_GRANT_DAYS) throw new ActionError(k("admin.premium.badDays", { n: MAX_GRANT_DAYS }));
    if (job.status !== "OPEN") throw new ActionError(k("admin.premium.jobNotOpen"));
    const start = later(job[field], now);
    const endsAt = new Date(start.getTime() + d * DAY);
    await db.$transaction([
      db.jobPromotion.create({ data: { jobId, kind, startsAt: start, endsAt, grantedById: adminId } }),
      db.job.update({ where: { id: jobId }, data: { [field]: endsAt } }),
    ]);
  }
  revalidatePath("/admin/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return k(d === 0 ? "admin.premium.promotionOff" : "admin.premium.promotionOn");
}
