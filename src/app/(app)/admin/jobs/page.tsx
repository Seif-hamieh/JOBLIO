import { Briefcase, Search, Star, Zap } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, Pagination } from "@/components/ui/misc";
import { JobActions } from "@/components/admin/job-actions";
import { SOURCE_NAMES } from "@/server/job-import/normalize";

const PAGE_SIZE = 50;
const STATUSES = ["OPEN", "CLOSED", "DRAFT", "PAUSED"] as const;
const STATUS_TONE = { OPEN: "mint", PAUSED: "ember", CLOSED: "neutral", DRAFT: "outline" } as const;

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.jobs") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, { t, f }, sp] = await Promise.all([requireAdmin(), getI18n(), searchParams]);
  const q = first(sp.q)?.trim().slice(0, 100) || undefined;
  const status = STATUSES.find((s) => s === first(sp.status));
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const where: Prisma.JobWhereInput = {
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] }),
    ...(status && { status }),
  };
  const [jobs, total] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, title: true, status: true, createdAt: true, featuredUntil: true, urgentUntil: true, externalSource: true, company: { select: { name: true } } },
    }),
    db.job.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/jobs?${s}` : "/admin/jobs";
  };
  const now = new Date();

  const th = "px-4 py-3 text-start text-xs font-medium text-fg-subtle";
  const td = "px-4 py-3 align-middle";

  return (
    <div className="space-y-5">
      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.jobTable.search")} aria-label={t("admin.jobTable.search")} maxLength={100} className="ps-10" />
        </div>
        <div className="sm:w-44">
          <Select name="status" defaultValue={status ?? ""} aria-label={t("admin.cols.status")}>
            <option value="">{t("admin.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`enums.jobStatus.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" className="h-11">
          {t("admin.search")}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">{t("admin.results", { n: total })}</p>

      {jobs.length === 0 ? (
        <EmptyState icon={<Briefcase />} title={t("admin.noData")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.cols.title")}</th>
                  <th scope="col" className={th}>{t("admin.cols.company")}</th>
                  <th scope="col" className={th}>{t("admin.cols.status")}</th>
                  <th scope="col" className={th}>{t("admin.jobTable.featured")}</th>
                  <th scope="col" className={th}>{t("admin.jobTable.urgent")}</th>
                  <th scope="col" className={th}>{t("admin.cols.posted")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const featured = !!j.featuredUntil && j.featuredUntil > now;
                  const urgent = !!j.urgentUntil && j.urgentUntil > now;
                  return (
                    <tr key={j.id} className="border-b border-border last:border-0">
                      <td className={`${td} max-w-64 font-medium`}>
                        <span className="block truncate">{j.title}</span>
                        {j.externalSource && (
                          <Badge tone="outline" size="xs" className="mt-1">
                            {t("admin.jobTable.importedFrom", { source: SOURCE_NAMES[j.externalSource] })}
                          </Badge>
                        )}
                      </td>
                      <td className={`${td} text-fg-muted`}>{j.company.name}</td>
                      <td className={td}>
                        <Badge tone={STATUS_TONE[j.status]} size="xs">{t(`enums.jobStatus.${j.status}`)}</Badge>
                      </td>
                      <td className={td}>
                        {featured ? <Star className="size-4 fill-current text-ember-fg" aria-label={t("admin.jobTable.featured")} /> : <span className="text-fg-subtle">—</span>}
                      </td>
                      <td className={td}>
                        {urgent ? <Zap className="size-4 fill-current text-danger-fg" aria-label={t("admin.jobTable.urgent")} /> : <span className="text-fg-subtle">—</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-fg-muted`}>{f.date(j.createdAt, { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className={td}>
                        <JobActions job={{ id: j.id, title: j.title, isOpen: j.status === "OPEN", isDraft: j.status === "DRAFT" }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination page={page} pageCount={pageCount} href={href} />
    </div>
  );
}
