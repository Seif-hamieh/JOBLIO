import Link from "next/link";
import { FileText, Search, Star } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, Pagination } from "@/components/ui/misc";

const PAGE_SIZE = 50;
// The real ApplicationStatus values (there is no SCREENING status in the schema).
const STATUSES = [
  { value: "APPLIED", key: "admin.filters.applied" },
  { value: "VIEWED", key: "admin.filters.viewed" },
  { value: "SHORTLISTED", key: "admin.filters.shortlisted" },
  { value: "INTERVIEW", key: "admin.filters.interview" },
  { value: "OFFER", key: "admin.filters.offer" },
  { value: "HIRED", key: "admin.filters.hired" },
  { value: "REJECTED", key: "admin.filters.rejected" },
  { value: "WITHDRAWN", key: "admin.filters.withdrawn" },
] as const;
const STATUS_TONE: Record<string, BadgeTone> = {
  APPLIED: "outline",
  VIEWED: "neutral",
  SHORTLISTED: "brand",
  INTERVIEW: "aurora",
  OFFER: "ember",
  HIRED: "mint",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.applications") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, { t, f }, sp] = await Promise.all([requireAdmin(), getI18n(), searchParams]);
  const q = first(sp.q)?.trim().slice(0, 100) || undefined;
  const status = STATUSES.find((s) => s.value === first(sp.status))?.value;
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const where: Prisma.ApplicationWhereInput = {
    ...(q && { OR: [{ applicant: { name: { contains: q, mode: "insensitive" } } }, { job: { title: { contains: q, mode: "insensitive" } } }] }),
    ...(status && { status }),
  };
  const [applications, total] = await Promise.all([
    db.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        matchScore: true,
        priorityAt: true,
        createdAt: true,
        applicant: { select: { name: true, email: true, image: true, username: true } },
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
      },
    }),
    db.application.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/applications?${s}` : "/admin/applications";
  };

  const th = "px-4 py-2.5 text-start text-xs font-semibold text-fg-muted";
  const td = "px-4 py-3 align-middle";
  const link = buttonClasses({ variant: "ghost", size: "xs" });

  return (
    <div className="space-y-5">
      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.appsTable.search")} aria-label={t("admin.appsTable.search")} maxLength={100} className="ps-10" />
        </div>
        <div className="sm:w-44">
          <Select name="status" defaultValue={status ?? ""} aria-label={t("admin.appsTable.status")}>
            <option value="">{t("admin.filters.all")}</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.key)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" className="h-11">
          {t("admin.search")}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">{t("admin.results", { n: total })}</p>

      {applications.length === 0 ? (
        <EmptyState icon={<FileText />} title={t("admin.noData")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-surface-2">
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.appsTable.applicant")}</th>
                  <th scope="col" className={th}>{t("admin.appsTable.job")}</th>
                  <th scope="col" className={th}>{t("admin.appsTable.company")}</th>
                  <th scope="col" className={th}>{t("admin.appsTable.status")}</th>
                  <th scope="col" className={th}>{t("admin.appsTable.priority")}</th>
                  <th scope="col" className={th}>{t("admin.appsTable.match")}</th>
                  <th scope="col" className={th}>{t("admin.appsTable.applied")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60">
                {applications.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={a.applicant.name} src={a.applicant.image} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium">{a.applicant.name}</div>
                          <div className="text-xs text-fg-subtle" dir="ltr">{a.applicant.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} max-w-56 truncate`}>{a.job.title}</td>
                    <td className={`${td} text-fg-muted`}>{a.job.company.name}</td>
                    <td className={td}>
                      <Badge tone={STATUS_TONE[a.status] ?? "neutral"} size="xs">{t(`enums.applicationStatus.${a.status}`)}</Badge>
                    </td>
                    <td className={td}>
                      {a.priorityAt ? <Star className="size-4 fill-current text-ember-fg" aria-label={t("admin.appsTable.priority")} /> : <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className={`${td} tabular-nums`}>{a.matchScore}%</td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{f.date(a.createdAt, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1.5">
                        {a.applicant.username && (
                          <Link href={`/in/${a.applicant.username}`} className={link}>
                            {t("admin.appsTable.viewApplicant")}
                          </Link>
                        )}
                        <Link href={`/jobs/${a.job.id}`} className={link}>
                          {t("admin.appsTable.viewJob")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination page={page} pageCount={pageCount} href={href} />
    </div>
  );
}
