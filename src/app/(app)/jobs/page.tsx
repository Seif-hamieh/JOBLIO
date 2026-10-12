import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Bookmark, SearchX, Sparkles, Star } from "lucide-react";
import { getViewer } from "@/server/session";
import { searchJobs } from "@/server/services/jobs";
import { listIndustries } from "@/server/services/companies";
import { db } from "@/server/db";
import { parseJobSearch, toQueryString } from "@/lib/validation/search";
import { JobCard } from "@/components/jobs/job-card";
import { ActiveFilterSummary, JobFilters, JobSearchBar, SaveSearchButton, SortSelect } from "@/components/jobs/job-filters";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("footer.findJobs");

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const params = parseJobSearch(await searchParams);
  const [viewer, { t }] = await Promise.all([getViewer(), getI18n()]);
  const [results, industries, skills] = await Promise.all([
    searchJobs(params, viewer?.id ?? null),
    listIndustries(),
    params.skills.length ? db.skill.findMany({ where: { slug: { in: params.skills } }, select: { slug: true, name: true } }) : [],
  ]);
  const skillNames = Object.fromEntries(skills.map((s) => [s.slug, s.name]));

  return (
    <div className="space-y-6">
      {viewer && <JobsTabs />}
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-[28px]">{t("jobs.searchTitle")}</h1>
        <p className="mt-1 text-fg-muted">{t("jobs.searchSub")}</p>
      </div>
      {/* Keyed on the query so "Clear search" (and back/forward) also resets the text fields. */}
      <JobSearchBar key={`${params.q ?? ""}|${params.location ?? ""}`} params={params} />

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <JobFilters params={params} industries={industries} skillNames={skillNames} />
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ActiveFilterSummary total={results.total + results.sponsored.length} params={params} />
            <div className="flex items-center gap-2">
              {viewer && <SaveSearchButton params={params} />}
              <SortSelect params={params} signedIn={!!viewer} />
            </div>
          </div>

          {!viewer && (
            <div className="flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand-soft/50 p-4 sm:flex-row sm:items-center">
              <Sparkles className="size-5 shrink-0 text-brand" />
              <p className="flex-1 text-sm">
                <span className="font-semibold">{t("jobs.upsellTitle")}</span> {t("jobs.upsellBody")}
              </p>
              <Link href="/register?intent=SEEKER" className={buttonClasses({ size: "sm", pill: true })}>
                {t("common.joinFree")}
              </Link>
            </div>
          )}

          {results.sponsored.map((job) => (
            <JobCard key={`s-${job.id}`} job={job} signedIn={!!viewer} placement="sponsored" />
          ))}
          {results.jobs.map((job) => (
            <JobCard key={job.id} job={job} signedIn={!!viewer} />
          ))}

          {results.jobs.length === 0 && results.sponsored.length === 0 && (
            <EmptyState
              icon={<SearchX />}
              title={t("jobs.noResults")}
              description={t("jobs.noResultsBody")}
              action={
                <Link href="/jobs" className={buttonClasses({ variant: "outline", pill: true })}>
                  {t("jobs.clearSearch")}
                </Link>
              }
            />
          )}

          <Pagination page={params.page} pageCount={results.pageCount} href={(page) => `/jobs${toQueryString(params, { page })}`} />

          <div className="grid gap-3 pt-4 sm:grid-cols-2">
            <Link href="/jobs/featured" className="surface surface-hover flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-ember-soft text-ember-fg">
                <Star className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t("jobs.featuredCardTitle")}</span>
                <span className="text-xs text-fg-muted">{t("jobs.featuredCardBody")}</span>
              </span>
            </Link>
            {viewer && (
              <Link href="/jobs/saved" className="surface surface-hover flex items-center gap-3 p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
                  <Bookmark className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t("jobs.savedCardTitle")}</span>
                  <span className="text-xs text-fg-muted">{t("jobs.savedCardBody")}</span>
                </span>
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
