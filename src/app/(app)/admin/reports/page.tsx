import Link from "next/link";
import { Flag } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/misc";
import { ReportActions } from "@/components/admin/report-actions";

// Open reports, newest activity first. Grouped by job in memory: one row per reported job.
const MAX_REPORTS = 500;

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.reports") };
}

export default async function AdminReportsPage() {
  const [, { t, f }] = await Promise.all([requireAdmin(), getI18n()]);
  const reports = await db.jobReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: MAX_REPORTS,
    select: {
      reason: true,
      details: true,
      createdAt: true,
      reporter: { select: { name: true } },
      job: { select: { id: true, title: true, status: true, externalSource: true, company: { select: { name: true } } } },
    },
  });

  type Group = { job: (typeof reports)[number]["job"]; count: number; reasons: Map<string, number>; latest: Date; notes: { text: string; by: string | null }[] };
  const groups = new Map<string, Group>();
  for (const r of reports) {
    const g: Group = groups.get(r.job.id) ?? { job: r.job, count: 0, reasons: new Map<string, number>(), latest: r.createdAt, notes: [] };
    g.count++;
    g.reasons.set(r.reason, (g.reasons.get(r.reason) ?? 0) + 1);
    if (r.details && g.notes.length < 3) g.notes.push({ text: r.details, by: r.reporter?.name ?? null });
    groups.set(r.job.id, g);
  }
  const rows = [...groups.values()];

  const th = "px-4 py-2.5 text-start text-xs font-semibold text-fg-muted";
  const td = "px-4 py-3 align-top";

  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-muted">{t("admin.reportsPage.sub")}</p>
      {rows.length === 0 ? (
        <EmptyState icon={<Flag />} title={t("admin.reportsPage.empty")} description={t("admin.reportsPage.emptyBody")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.cols.title")}</th>
                  <th scope="col" className={th}>{t("admin.reportsPage.reports")}</th>
                  <th scope="col" className={th}>{t("admin.reportsPage.notes")}</th>
                  <th scope="col" className={th}>{t("admin.reportsPage.lastReport")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
                {rows.map((g) => (
                  <tr key={g.job.id} className="border-b border-border last:border-0">
                    <td className={`${td} max-w-64`}>
                      <Link href={`/jobs/${g.job.id}`} className="block truncate font-medium hover:underline">
                        {g.job.title}
                      </Link>
                      <div className="truncate text-xs text-fg-subtle">{g.job.company.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={g.job.status === "OPEN" ? "mint" : "neutral"} size="xs">{t(`enums.jobStatus.${g.job.status}`)}</Badge>
                        {g.job.externalSource && <Badge tone="outline" size="xs">{t("admin.reportsPage.imported")}</Badge>}
                      </div>
                    </td>
                    <td className={td}>
                      <div className="font-display text-lg font-semibold tabular-nums">{f.number(g.count)}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {[...g.reasons].map(([reason, n]) => (
                          <Badge key={reason} tone="danger" size="xs">
                            {t(`jobs.reportReasons.${reason}`)}
                            {n > 1 && ` ×${n}`}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className={`${td} max-w-72 text-fg-muted`}>
                      {g.notes.length ? (
                        <ul className="space-y-1.5">
                          {g.notes.map((n, i) => (
                            <li key={i} className="line-clamp-3 break-words text-xs">
                              “{n.text}”<span className="text-fg-subtle"> — {n.by ?? t("admin.reportsPage.visitor")}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{f.date(g.latest, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className={td}>
                      <ReportActions job={{ id: g.job.id, title: g.job.title, isOpen: g.job.status === "OPEN" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
