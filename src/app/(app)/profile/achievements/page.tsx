import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { checkAchievements } from "@/server/services/achievements";
import { AchievementBadge } from "@/components/profile/achievement-badge";
import { Card, PageHeader } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/motion";
import { ACHIEVEMENT_CODES, type AchievementCode } from "@/lib/achievements";

export const generateMetadata = pageTitle("profile.achievements");

export default async function AchievementsPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  // Re-evaluate on visit so nothing earned is ever missed.
  await checkAchievements(viewer.id);
  const earned = await db.userAchievement.findMany({ where: { userId: viewer.id }, select: { code: true, awardedAt: true } });
  const map = new Map(earned.map((e) => [e.code as AchievementCode, e.awardedAt]));
  return (
    <div className="space-y-6">
      <PageHeader title={t("profile.achievements")} description={t("profileEdit.achievementsSub", { earned: map.size, total: ACHIEVEMENT_CODES.length })} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACHIEVEMENT_CODES.map((code, i) => {
          const at = map.get(code);
          return (
            <Reveal key={code} delay={i * 0.04}>
              <Card className={`flex h-full flex-col items-center p-6 text-center ${at ? "" : "opacity-80"}`}>
                <AchievementBadge code={code} earned={!!at} showLabel={false} />
                <h3 className="mt-4 font-display font-semibold">{t(`achievementsDef.${code}.title`)}</h3>
                <p className="mt-1 text-sm text-fg-muted">{t(`achievementsDef.${code}.description`)}</p>
                <p className="mt-auto pt-4 text-xs text-fg-subtle">
                  {at
                    ? t("profileEdit.earnedOn", { date: f.date(at, { month: "short", day: "numeric", year: "numeric" }) })
                    : t("profileEdit.howToEarn", { rule: t(`achievementsDef.${code}.rule`) })}
                </p>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
