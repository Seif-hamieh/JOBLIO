import { Briefcase, Building2, CreditCard, FileText, Receipt, Users } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Stat } from "@/components/ui/misc";

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.title") };
}

const JOB_TONE = { OPEN: "mint", PAUSED: "ember", CLOSED: "neutral", DRAFT: "outline" } as const;

export default async function AdminDashboardPage() {
  // The layout already checks, but pages render in parallel with it — check here too.
  const [, { t, f }] = await Promise.all([requireAdmin(), getI18n()]);

  const [
    totalUsers,
    totalCompanies,
    totalJobs,
    openJobs,
    totalApplications,
    totalSubscriptions,
    activeSubscriptions,
    totalPayments,
    recentUsers,
    recentJobs,
  ] = await Promise.all([
    db.user.count(),
    db.company.count(),
    db.job.count(),
    db.job.count({ where: { status: "OPEN" } }),
    db.application.count(),
    db.subscription.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.payment.count({ where: { status: "SUCCEEDED" } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, email: true, createdAt: true, platformRole: true } }),
    db.job.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true, status: true, createdAt: true, company: { select: { name: true } } } }),
  ]);

  const date = (d: Date) => f.date(d, { day: "numeric", month: "short", year: "numeric" });
  const th = "px-4 py-2.5 text-start text-xs font-semibold text-fg-muted";
  const td = "px-4 py-3 align-middle";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Stat label={t("admin.stats.users")} value={f.number(totalUsers)} icon={<Users />} />
        <Stat label={t("admin.stats.companies")} value={f.number(totalCompanies)} icon={<Building2 />} />
        <Stat
          label={t("admin.stats.jobs")}
          value={`${f.number(openJobs)} / ${f.number(totalJobs)}`}
          hint={`${t("admin.stats.openJobs")} / ${t("admin.stats.jobs")}`}
          icon={<Briefcase />}
        />
        <Stat label={t("admin.stats.applications")} value={f.number(totalApplications)} icon={<FileText />} />
        <Stat label={t("admin.stats.subscriptions")} value={`${f.number(activeSubscriptions)} / ${f.number(totalSubscriptions)}`} icon={<CreditCard />} />
        <Stat label={t("admin.stats.payments")} value={f.number(totalPayments)} icon={<Receipt />} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={t("admin.recentUsers")} className="p-5 pb-3 sm:px-6" />
        {recentUsers.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-fg-muted sm:px-6">{t("admin.noData")}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-y border-border">
                  <th scope="col" className={th}>{t("admin.cols.name")}</th>
                  <th scope="col" className={th}>{t("admin.cols.email")}</th>
                  <th scope="col" className={th}>{t("admin.cols.role")}</th>
                  <th scope="col" className={th}>{t("admin.cols.joined")}</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className={`${td} font-medium`}>{u.name}</td>
                    <td className={`${td} text-fg-muted`} dir="ltr">{u.email}</td>
                    <td className={td}>{u.platformRole === "ADMIN" ? <Badge tone="brand" size="xs">{t("admin.badge")}</Badge> : <span className="text-fg-subtle">—</span>}</td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{date(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={t("admin.recentJobs")} className="p-5 pb-3 sm:px-6" />
        {recentJobs.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-fg-muted sm:px-6">{t("admin.noData")}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-y border-border">
                  <th scope="col" className={th}>{t("admin.cols.title")}</th>
                  <th scope="col" className={th}>{t("admin.cols.company")}</th>
                  <th scope="col" className={th}>{t("admin.cols.status")}</th>
                  <th scope="col" className={th}>{t("admin.cols.posted")}</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
                {recentJobs.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0">
                    <td className={`${td} font-medium`}>{j.title}</td>
                    <td className={`${td} text-fg-muted`}>{j.company.name}</td>
                    <td className={td}>
                      <Badge tone={JOB_TONE[j.status]} size="xs">{t(`enums.jobStatus.${j.status}`)}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{date(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
