import { BadgeCheck, Building2, Search, TriangleAlert } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { requireAdmin } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, Pagination } from "@/components/ui/misc";
import { CompanyActions } from "@/components/admin/company-actions";

const PAGE_SIZE = 50;
const FILTERS = ["verified", "unverified"] as const;

export async function generateMetadata() {
  return { title: (await getI18n()).t("admin.companies") };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, { t, f }, sp] = await Promise.all([requireAdmin(), getI18n(), searchParams]);
  const q = first(sp.q)?.trim().slice(0, 100) || undefined;
  const filter = FILTERS.find((v) => v === first(sp.filter));
  const pageNum = Number(first(sp.page));
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const where: Prisma.CompanyWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }),
    ...(filter && { verified: filter === "verified" }),
  };
  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true, verified: true, followerCount: true, createdAt: true, _count: { select: { jobs: true } } },
    }),
    db.company.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter) params.set("filter", filter);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin/companies?${s}` : "/admin/companies";
  };

  const th = "px-4 py-3 text-start text-xs font-medium text-fg-subtle";
  const td = "px-4 py-3 align-middle";

  return (
    <div className="space-y-5">
      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input name="q" type="search" defaultValue={q} placeholder={t("admin.companiesTable.search")} aria-label={t("admin.companiesTable.search")} maxLength={100} className="ps-10" />
        </div>
        <div className="sm:w-44">
          <Select name="filter" defaultValue={filter ?? ""} aria-label={t("admin.companiesTable.verified")}>
            <option value="">{t("admin.filters.all")}</option>
            <option value="verified">{t("admin.filters.verified")}</option>
            <option value="unverified">{t("admin.filters.unverified")}</option>
          </Select>
        </div>
        <Button type="submit" variant="outline" className="h-11">
          {t("admin.search")}
        </Button>
      </form>
      <p className="text-sm text-fg-muted">{t("admin.results", { n: total })}</p>

      {companies.length === 0 ? (
        <EmptyState icon={<Building2 />} title={t("admin.noData")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{t("admin.companiesTable.name")}</th>
                  <th scope="col" className={th}>{t("admin.companiesTable.slug")}</th>
                  <th scope="col" className={th}>{t("admin.companiesTable.verified")}</th>
                  <th scope="col" className={th}>{t("admin.companiesTable.jobs")}</th>
                  <th scope="col" className={th}>{t("admin.companiesTable.followers")}</th>
                  <th scope="col" className={th}>{t("admin.companiesTable.created")}</th>
                  <th scope="col" className={th}><span className="sr-only">{t("admin.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={c.name} src={c.logoUrl} color={c.brandColor} size="sm" />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className={`${td} text-fg-muted`} dir="ltr">{c.slug}</td>
                    <td className={td}>
                      {c.verified ? (
                        <Badge tone="mint" size="xs"><BadgeCheck /> {t("admin.companiesTable.verified")}</Badge>
                      ) : (
                        <Badge tone="ember" size="xs"><TriangleAlert /> {t("admin.companiesTable.unverified")}</Badge>
                      )}
                    </td>
                    <td className={`${td} tabular-nums`}>{f.number(c._count.jobs)}</td>
                    <td className={`${td} tabular-nums`}>{f.number(c.followerCount)}</td>
                    <td className={`${td} whitespace-nowrap text-fg-muted`}>{f.date(c.createdAt, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className={td}>
                      <CompanyActions company={{ id: c.id, name: c.name, slug: c.slug, verified: c.verified }} />
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
