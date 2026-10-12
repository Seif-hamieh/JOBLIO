import { getI18n, pageTitle } from "@/i18n/server";
import { industryName } from "@/i18n/translate";
import Link from "next/link";
import { BadgeCheck, Briefcase, Building2, Search, Users } from "lucide-react";
import { getViewer } from "@/server/session";
import { db, type Prisma } from "@/server/db";
import { companyCardSelect, listIndustries } from "@/server/services/companies";
import { expirePromotions } from "@/server/services/jobs";
import { FollowCompanyButton } from "@/components/companies/follow-button";
import { CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { NavTabs } from "@/components/ui/controls";
import { COMPANY_SIZES, type CompanySize } from "@/lib/constants";
import { resolveCountryCode } from "@/lib/geo";

export const generateMetadata = pageTitle("nav.companies");

const PER_PAGE = 18;

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const sp = await searchParams;
  const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const q = str(sp.q);
  const industry = str(sp.industry, 60);
  const size = COMPANY_SIZES.includes(str(sp.size) as CompanySize) ? (str(sp.size) as CompanySize) : "";
  const location = str(sp.location);
  const hiring = sp.hiring === "1";
  const page = Math.max(1, Math.min(200, Number(sp.page) || 1));

  const [viewer, { t, f }] = await Promise.all([getViewer(), getI18n()]);
  await expirePromotions();
  const and: Prisma.CompanyWhereInput[] = [];
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { tagline: { contains: q, mode: "insensitive" } }] });
  if (industry) and.push({ industry: { slug: industry } });
  if (size) and.push({ size });
  if (location) {
    const code = resolveCountryCode(location);
    and.push({ OR: [{ city: { contains: location, mode: "insensitive" } }, ...(code ? [{ countryCode: code }] : [])] });
  }
  if (hiring) and.push({ jobs: { some: { status: "OPEN" } } });
  const where: Prisma.CompanyWhereInput = { AND: and };

  const [companies, total, industries, follows] = await Promise.all([
    db.company.findMany({
      where,
      select: companyCardSelect,
      // Premium company pages are surfaced first, then by popularity.
      orderBy: [{ premiumUntil: { sort: "desc", nulls: "last" } }, { followerCount: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.company.count({ where }),
    listIndustries(),
    viewer ? db.companyFollower.findMany({ where: { userId: viewer.id }, select: { companyId: true } }) : [],
  ]);
  const followed = new Set(follows.map((x) => x.companyId));
  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const all = { q, industry, size, location, hiring: hiring ? "1" : "", page: 1, ...overrides };
    for (const [k, v] of Object.entries(all)) if (v && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return s ? `/companies?${s}` : "/companies";
  };

  return (
    <div className="space-y-6">
      {viewer && (
        <NavTabs
          layoutId="network-tabs"
          tabs={[
            { href: "/network", label: t("network.tabNetwork") },
            { href: "/companies", label: t("network.tabCompanies") },
            { href: "/professionals/featured", label: t("network.tabFeatured") },
          ]}
        />
      )}
      <PageHeader title={t("companies.title")} description={t("companies.sub")} />

      <form key={[q, industry, size, location, hiring].join("|")} className="grid gap-2 rounded-2xl border border-border bg-surface p-2 shadow-card sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <label className="flex items-center gap-2 px-3">
          <Search className="size-4 text-fg-subtle" />
          <input name="q" defaultValue={q} placeholder={t("companies.name")} className="h-10 w-full bg-transparent text-sm outline-none" aria-label={t("companies.name")} />
        </label>
        <select name="industry" defaultValue={industry} className="h-10 rounded-xl bg-surface-2 px-3 text-sm outline-none" aria-label={t("jobs.industry")}>
          <option value="">{t("jobs.allIndustries")}</option>
          {industries.map((i) => (
            <option key={i.slug} value={i.slug}>
              {industryName(t, i.name)}
            </option>
          ))}
        </select>
        <select name="size" defaultValue={size} className="h-10 rounded-xl bg-surface-2 px-3 text-sm outline-none" aria-label={t("onboarding.size")}>
          <option value="">{t("companies.anySize")}</option>
          {COMPANY_SIZES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.companySize.${s}`)}
            </option>
          ))}
        </select>
        <input name="location" defaultValue={location} placeholder={t("companies.location")} className="h-10 rounded-xl bg-surface-2 px-3 text-sm outline-none" aria-label={t("jobs.location")} />
        <button className="h-10 rounded-xl bg-fg px-5 text-sm font-medium text-bg">{t("common.search")}</button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <span className="text-fg-muted">
          <span className="font-semibold text-fg">{t("companies.count", { n: total })}</span>
        </span>
        <Link href={qs({ hiring: hiring ? "" : "1" })} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${hiring ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border text-fg-muted"}`}>
          {t("companies.hiring")}
        </Link>
      </div>

      {companies.length === 0 ? (
        <EmptyState icon={<Building2 />} title={t("companies.none")} description={t("companies.noneBody")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => {
            const premium = !!c.premiumUntil && c.premiumUntil > new Date();
            return (
              <article key={c.id} className="surface surface-hover group relative flex flex-col overflow-hidden">
                <div
                  className="h-24 bg-cover bg-center"
                  style={c.coverUrl ? { backgroundImage: `url(${c.coverUrl})` } : { backgroundImage: `linear-gradient(120deg, ${c.brandColor ?? "var(--brand)"}, var(--aurora))` }}
                />
                <div className="flex flex-1 flex-col px-5 pb-5">
                  <CompanyLogo name={c.name} src={c.logoUrl} color={c.brandColor} size="lg" className="relative z-10 -mt-7 ring-4 ring-surface" />
                  <div className="mt-3 flex items-center gap-1.5">
                    <Link href={`/companies/${c.slug}`} className="font-display font-semibold after:absolute after:inset-0">
                      {c.name}
                    </Link>
                    {c.verified && <BadgeCheck className="size-4 text-brand" />}
                    {premium && (
                      <Badge tone="ember" size="xs">
                        {t("common.premium")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{c.tagline}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle">
                    {c.industry && <span>{industryName(t, c.industry.name)}</span>}
                    <span>{t(`enums.companySize.${c.size}`)}</span>
                    {(c.city || c.countryCode) && <span>{f.location(c.city, c.countryCode)}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="flex gap-3 text-xs text-fg-muted">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="size-3.5" /> {t("companies.jobs", { n: c._count.jobs })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" /> {f.compact(c.followerCount)}
                      </span>
                    </div>
                    <div className="relative z-10">
                      <FollowCompanyButton companyId={c.id} following={followed.has(c.id)} signedIn={!!viewer} size="sm" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} href={(p) => qs({ page: p })} />
    </div>
  );
}
