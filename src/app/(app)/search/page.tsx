import Link from "next/link";
import { ArrowRight, Briefcase, Building2, MapPin, Search, SearchX, Users } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { getViewer } from "@/server/session";
import { globalSearch } from "@/server/services/search";
import { JobCard } from "@/components/jobs/job-card";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata({ searchParams }: PageProps<"/search">) {
  const { t } = await getI18n();
  const q = String((await searchParams).q ?? "").trim();
  return { title: q ? t("search.titleFor", { q }) : t("search.title"), robots: { index: false } };
}

function Section({ icon: Icon, title, count, children, more }: { icon: typeof Users; title: string; count: number; children: React.ReactNode; more?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Icon className="size-[18px] text-brand" /> {title}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">{count}</span>
        </h2>
        {more}
      </div>
      {children}
    </section>
  );
}

/** One search for people, companies and jobs (the header search box lands here). */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const query = String(Array.isArray(raw) ? raw[0] : (raw ?? ""));
  const [viewer, { t, f }] = await Promise.all([getViewer(), getI18n()]);
  const { q, people, companies, jobs, jobTotal } = await globalSearch(query, viewer?.id ?? null);
  const nothing = q && !people.length && !companies.length && !jobs.length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-[28px]">{t("search.title")}</h1>
        <p className="mt-1 text-fg-muted">{t("search.sub")}</p>
      </div>
      {/* Plain GET form: works without JavaScript and keeps the query in the URL. key resets it when the query changes. */}
      <form key={q} action="/search" role="search" className="surface flex items-center gap-2 p-2 ps-4">
        <Search className="size-5 shrink-0 text-fg-subtle" />
        <input
          name="q"
          defaultValue={q}
          autoFocus={!q}
          placeholder={t("nav.searchPlaceholder")}
          aria-label={t("common.search")}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        <button type="submit" className={buttonClasses({ pill: true })}>
          {t("common.search")}
        </button>
      </form>

      {!q && <EmptyState icon={<Search />} title={t("search.startTitle")} description={t("search.startBody")} />}
      {nothing && <EmptyState icon={<SearchX />} title={t("search.noResults", { q })} description={t("search.noResultsBody")} />}

      {people.length > 0 && (
        <Section icon={Users} title={t("search.people")} count={people.length}>
          <Card className="divide-y divide-border">
            {people.map((p) => (
              <Link key={p.id} href={`/in/${p.username}`} className="flex items-center gap-3 p-4 transition hover:bg-surface-2/60">
                <Avatar name={p.name} src={p.image} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    {p.profile?.openToWork && <OpenToWorkBadge />}
                  </div>
                  {p.profile?.headline && (
                    <div className="truncate text-sm text-fg-muted" dir="auto">
                      {p.profile.headline}
                    </div>
                  )}
                  {(p.profile?.city || p.profile?.countryCode) && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-fg-subtle">
                      <MapPin className="size-3" /> {f.location(p.profile.city, p.profile.countryCode)}
                    </div>
                  )}
                </div>
                <ArrowRight className="size-4 shrink-0 text-fg-subtle rtl:rotate-180" />
              </Link>
            ))}
          </Card>
        </Section>
      )}

      {companies.length > 0 && (
        <Section
          icon={Building2}
          title={t("search.companies")}
          count={companies.length}
          more={
            <Link href={`/companies?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-brand-soft-fg hover:underline">
              {t("search.seeAll")}
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug}`} className="surface surface-hover flex items-center gap-3 p-4">
                <CompanyLogo name={c.name} src={c.logoUrl} color={c.brandColor} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.name}</div>
                  {c.tagline && <div className="truncate text-sm text-fg-muted">{c.tagline}</div>}
                  <div className="mt-0.5 text-xs text-fg-subtle">{t("search.openJobs", { n: c._count.jobs })}</div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {jobs.length > 0 && (
        <Section
          icon={Briefcase}
          title={t("search.jobs")}
          count={jobTotal}
          more={
            <Link href={`/jobs?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-brand-soft-fg hover:underline">
              {t("search.seeAllJobs", { n: jobTotal })}
            </Link>
          }
        >
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} signedIn={!!viewer} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
