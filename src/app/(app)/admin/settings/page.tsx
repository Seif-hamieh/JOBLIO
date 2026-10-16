import { Briefcase, Building2, Factory, Sparkles, Users } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db } from "@/server/db";
import { Card, CardHeader, Stat } from "@/components/ui/misc";
import { RevalidateButton } from "@/components/admin/revalidate-button";

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.settingsPage.title") };
}

export default async function AdminSettingsPage() {
  const [, { t, f }] = await Promise.all([requireAdmin(), getI18n()]);
  const [skills, industries, jobs, companies, users] = await Promise.all([
    db.skill.count(),
    db.industry.count(),
    db.job.count(),
    db.company.count(),
    db.user.count(),
  ]);

  // Set automatically on Vercel deployments; empty in local development.
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  const info = [
    { label: t("admin.settingsPage.nodeVersion"), value: process.version },
    { label: t("admin.settingsPage.environment"), value: process.env.NODE_ENV === "production" ? "production" : "development" },
    { label: t("admin.settingsPage.commit"), value: commit ? commit.slice(0, 7) : "—" },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("admin.settingsPage.statsTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Stat label={t("admin.settingsPage.skills")} value={f.number(skills)} icon={<Sparkles />} />
          <Stat label={t("admin.settingsPage.industries")} value={f.number(industries)} icon={<Factory />} />
          <Stat label={t("admin.jobs")} value={f.number(jobs)} icon={<Briefcase />} />
          <Stat label={t("admin.companies")} value={f.number(companies)} icon={<Building2 />} />
          <Stat label={t("admin.users")} value={f.number(users)} icon={<Users />} />
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <CardHeader title={t("admin.settingsPage.maintenance")} description={t("admin.settingsPage.maintenanceHint")} />
        <div className="mt-4 flex flex-wrap gap-2">
          <RevalidateButton path="/" label={t("admin.settingsPage.revalidateHome")} />
          <RevalidateButton path="/jobs" label={t("admin.settingsPage.revalidateJobs")} />
          <RevalidateButton path="/premium" label={t("admin.settingsPage.revalidatePremium")} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader title={t("admin.settingsPage.systemInfo")} />
        <dl className="mt-4 divide-y divide-border text-sm">
          {info.map((i) => (
            <div key={i.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-fg-muted">{i.label}</dt>
              <dd className="font-mono text-xs" dir="ltr">
                {i.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
