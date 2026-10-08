import "server-only";
import { db } from "@/server/db";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";
import { ACHIEVEMENTS, type AchievementCode } from "@/lib/achievements";

type Rule = (userId: string) => Promise<boolean>;

const DAY = 24 * 60 * 60 * 1000;

const RULES: Record<AchievementCode, Rule> = {
  PROFILE_COMPLETE: async (userId) => {
    const p = await db.profile.findUnique({ where: { userId }, select: { completeness: true } });
    return (p?.completeness ?? 0) >= 100;
  },
  VERIFIED_PROFESSIONAL: async (userId) => {
    const u = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true, profile: { select: { completeness: true } } } });
    return !!u?.emailVerified && (u.profile?.completeness ?? 0) >= 80;
  },
  TOP_SKILL: async (userId) =>
    (await db.userSkill.count({ where: { profile: { userId }, endorsementCount: { gte: 5 } } })) > 0,
  RISING_TALENT: async (userId) =>
    (await db.profileView.count({ where: { viewedId: userId, createdAt: { gte: new Date(Date.now() - 30 * DAY) } } })) >= 25,
  FAST_APPLICANT: async (userId) => {
    const apps = await db.application.findMany({
      where: { applicantId: userId },
      select: { createdAt: true, job: { select: { publishedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return apps.some((a) => a.job.publishedAt && a.createdAt.getTime() - a.job.publishedAt.getTime() < DAY);
  },
  TOP_CANDIDATE: async (userId) =>
    (await db.application.count({
      where: { applicantId: userId, status: { in: ["SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"] } },
    })) > 0,
  CAREER_EXPLORER: async (userId) => {
    const [saved, follows] = await Promise.all([
      db.savedJob.count({ where: { userId } }),
      db.companyFollower.count({ where: { userId } }),
    ]);
    return saved >= 10 || follows >= 5;
  },
  NETWORK_BUILDER: async (userId) =>
    (await db.connection.count({
      where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    })) >= 25,
};

/**
 * Evaluates the given achievements (or all) and awards any newly earned ones.
 * Cheap enough to call after the relevant actions; failures never block them.
 */
export async function checkAchievements(userId: string, codes?: AchievementCode[]) {
  try {
    const owned = new Set(
      (await db.userAchievement.findMany({ where: { userId }, select: { code: true } })).map((a) => a.code),
    );
    const toCheck = (codes ?? (Object.keys(RULES) as AchievementCode[])).filter((c) => !owned.has(c));
    for (const code of toCheck) {
      if (!(await RULES[code](userId))) continue;
      const created = await db.userAchievement.createMany({ data: [{ userId, code }], skipDuplicates: true });
      if (created.count > 0) {
        await notify({
          userId,
          type: "ACHIEVEMENT_UNLOCKED",
          title: k("notif.achievement", { title: `@achievementsDef.${code}.title` }),
          body: k(`achievementsDef.${code}.description`),
          href: "/profile/achievements",
        });
      }
    }
  } catch (err) {
    console.error("[achievements]", err);
  }
}
