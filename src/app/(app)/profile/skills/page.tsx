import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { SkillManager } from "@/components/skills/skill-manager";
import { SkillConstellation } from "@/components/skills/skill-constellation";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { SKILL_LEVELS } from "@/lib/constants";

export const generateMetadata = pageTitle("profile.tabSkills");

export default async function SkillsPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const skills = await db.userSkill.findMany({
    where: { profileId: viewer.profileId },
    orderBy: { position: "asc" },
    select: { id: true, skillId: true, level: true, years: true, isTop: true, endorsementCount: true, skill: { select: { name: true, category: true } } },
  });
  const managed = skills.map((s) => ({ id: s.id, skillId: s.skillId, name: s.skill.name, category: s.skill.category, level: s.level, years: s.years, isTop: s.isTop, endorsementCount: s.endorsementCount }));
  const totalEndorsements = skills.reduce((n, s) => n + s.endorsementCount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <PageHeader title={t("skills.manageTitle")} description={t("skills.manageSub")} />
        <Card className="p-6">
          <SkillManager initial={managed} />
        </Card>
      </div>
      <aside className="space-y-4">
        <Card className="p-5">
          <CardHeader title={t("skills.mapTitle")} description={t("skills.mapSub", { skills: skills.length, endorsements: totalEndorsements })} />
          <div className="mt-3">
            <SkillConstellation name={viewer.name} skills={managed.map((s) => ({ id: s.id, name: s.name, category: s.category, level: s.level, endorsements: s.endorsementCount }))} />
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader title={t("skills.levelsTitle")} />
          <dl className="mt-3 space-y-2.5 text-sm">
            {SKILL_LEVELS.map((l, i) => (
              <div key={l}>
                <dt className="font-medium">{t(`enums.skillLevel.${l}`)}</dt>
                <dd className="text-xs text-fg-muted">
                  {t(`skills.level${i + 1}`)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-fg-muted">
            {t("skills.creditNote")}
          </p>
        </Card>
      </aside>
    </div>
  );
}
