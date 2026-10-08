import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { BarChart3, Crown, Eye, Heart, Percent, Users } from "lucide-react";
import { canManageCompany, requireRecruiter } from "@/server/session";
import { db } from "@/server/db";
import { listIndustries } from "@/server/services/companies";
import { CompanyEditor } from "@/components/companies/company-editor";
import { Bars } from "@/components/charts/bars";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { NavTabs } from "@/components/ui/controls";

export const generateMetadata = pageTitle("nav.companyDashboard");

export default async function CompanyDashboardPage() {
  const [viewer, { t, f }] = await Promise.all([requireRecruiter(), getI18n()]);
  const since = new Date(Date.now() - 13 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const [company, industries, stats, jobs, members] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: viewer.company.id }, include: { media: { orderBy: { position: "asc" } } } }),
    listIndustries(),
    db.jobDailyStat.findMany({ where: { job: { companyId: viewer.company.id }, date: { gte: since } }, select: { date: true, views: true, applications: true } }),
    db.job.findMany({
      where: { companyId: viewer.company.id, status: { in: ["OPEN", "PAUSED"] } },
      orderBy: { viewCount: "desc" },
      select: { id: true, title: true, viewCount: true, applicationCount: true, saveCount: true, status: true },
    }),
    db.companyMember.findMany({ where: { companyId: viewer.company.id }, select: { role: true, title: true, user: { select: { name: true, image: true, username: true } } } }),
  ]);
  const premium = !!company.premiumUntil && company.premiumUntil > new Date();

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000);
    return { key: d.toISOString().slice(0, 10), label: f.date(d, { month: "short", day: "numeric", timeZone: "UTC" }), views: 0, applications: 0 };
  });
  for (const s of stats) {
    const day = days.find((d) => d.key === s.date.toISOString().slice(0, 10));
    if (day) {
      day.views += s.views;
      day.applications += s.applications;
    }
  }
  const totalViews = days.reduce((n, d) => n + d.views, 0);
  const totalApps = days.reduce((n, d) => n + d.applications, 0);
  const conversion = totalViews ? Math.round((totalApps / totalViews) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <NavTabs
        layoutId="recruiter-tabs"
        tabs={[
          { href: "/recruiter", label: t("recruiter.tabDashboard"), exact: true },
          { href: "/recruiter/candidates", label: t("recruiter.tabCandidates") },
          { href: "/recruiter/saved", label: t("recruiter.tabSaved") },
          { href: "/interviews", label: t("recruiter.tabInterviews") },
          { href: "/company/dashboard", label: t("recruiter.tabCompany") },
        ]}
      />
      <PageHeader
        title={company.name}
        description={t("companyDash.sub")}
        actions={
          <>
            {premium ? (
              <Badge tone="ember" size="md">
                <Crown /> {t("companyDash.premiumPage")}
              </Badge>
            ) : (
              <Link href="/premium#business" className={buttonClasses({ variant: "soft", size: "sm", pill: true })}>
                <Crown /> {t("companyDash.upgrade")}
              </Link>
            )}
            <Link href={`/companies/${company.slug}`} className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
              {t("companyDash.viewPage")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("companyDash.jobViews")} value={f.compact(totalViews)} icon={<Eye />} />
        <Stat label={t("companyDash.applications")} value={totalApps} icon={<Users />} />
        <Stat label={t("companyDash.rate")} value={`${conversion}%`} icon={<Percent />} />
        <Stat label={t("companyDash.followers")} value={f.compact(company.followerCount)} icon={<Heart />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader title={t("companyDash.viewsChart")} description={t("companyDash.allJobs14")} />
          <Bars data={days.map((d) => ({ label: d.label, value: d.views }))} label={t("companyDash.viewsChart")} height={130} className="mt-5" />
        </Card>
        <Card className="p-6">
          <CardHeader title={t("companyDash.appsChart")} description={t("companyDash.allJobs14")} />
          <Bars data={days.map((d) => ({ label: d.label, value: d.applications }))} tone="mint" label={t("companyDash.appsChart")} height={130} className="mt-5" />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 p-6 pb-3">
          <BarChart3 className="size-4 text-brand" />
          <h2 className="font-display font-semibold">{t("companyDash.performance")}</h2>
          {!premium && (
            <Link href="/premium#business" className="text-xs text-ember-fg hover:underline">
              {t("companyDash.premiumHint")}
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-border bg-surface-2/60 text-start text-xs text-fg-muted">
                <th className="px-6 py-2.5 text-start font-medium">{t("companyDash.job")}</th>
                <th className="px-3 py-2.5 text-end font-medium">{t("recruiter.views")}</th>
                <th className="px-3 py-2.5 text-end font-medium">{t("companyDash.appsChart")}</th>
                {premium && <th className="px-3 py-2.5 text-end font-medium">{t("companyDash.saves")}</th>}
                {premium && <th className="px-6 py-2.5 text-end font-medium">{t("companyDash.conversion")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="px-6 py-3">
                    <Link href={`/recruiter/jobs/${j.id}/pipeline`} className="font-medium hover:underline">
                      {j.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-end tabular-nums">{j.viewCount}</td>
                  <td className="px-3 py-3 text-end tabular-nums">{j.applicationCount}</td>
                  {premium && <td className="px-3 py-3 text-end tabular-nums">{j.saveCount}</td>}
                  {premium && <td className="px-6 py-3 text-end tabular-nums">{j.viewCount ? `${Math.round((j.applicationCount / j.viewCount) * 1000) / 10}%` : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <CardHeader title={t("companyDash.pageTitle")} description={t("companyDash.pageSub")} />
          <div className="mt-5">
            <CompanyEditor
              companyId={company.id}
              canManage={canManageCompany(viewer, company.id)}
              premium={premium}
              industries={industries}
              logoUrl={company.logoUrl}
              coverUrl={company.coverUrl}
              media={company.media}
              initial={{
                name: company.name,
                tagline: company.tagline ?? "",
                about: company.about ?? "",
                website: company.website ?? "",
                industryId: company.industryId ?? "",
                size: company.size,
                foundedYear: company.foundedYear,
                city: company.city ?? "",
                countryCode: company.countryCode ?? "",
                benefits: company.benefits,
                values: company.values,
                cultureText: company.cultureText ?? "",
                brandColor: company.brandColor ?? "",
              }}
            />
          </div>
        </Card>
        <Card className="h-fit p-5">
          <CardHeader title={t("companyDash.team", { n: members.length })} />
          <ul className="mt-3 space-y-3">
            {members.map((m) => (
              <li key={m.user.username} className="flex items-center gap-3">
                <Avatar name={m.user.name} src={m.user.image} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/in/${m.user.username}`} className="truncate text-sm font-semibold hover:underline">
                    {m.user.name}
                  </Link>
                  <div className="truncate text-xs text-fg-muted">{m.title}</div>
                </div>
                <Badge size="xs">{t(`enums.companyRole.${m.role}`)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
