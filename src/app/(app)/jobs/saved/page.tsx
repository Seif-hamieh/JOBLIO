import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Bookmark, Bell, Search } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { jobCardSelect } from "@/server/services/jobs";
import { getCandidateFacts, scoreJobs } from "@/server/services/matching";
import { JobCard } from "@/components/jobs/job-card";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { DeleteSavedSearch } from "@/components/jobs/saved-search-actions";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { toQueryString } from "@/lib/validation/search";

export const generateMetadata = pageTitle("jobs.savedTitle");

export default async function SavedJobsPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const [saved, searches, facts, applied] = await Promise.all([
    db.savedJob.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, select: { job: { select: jobCardSelect } } }),
    db.savedSearch.findMany({ where: { userId: viewer.id, kind: "JOB" }, orderBy: { createdAt: "desc" } }),
    getCandidateFacts(viewer.id),
    db.application.findMany({ where: { applicantId: viewer.id }, select: { jobId: true } }),
  ]);
  const jobs = saved.map((s) => s.job);
  const matches = scoreJobs(facts, jobs);
  const appliedSet = new Set(applied.map((a) => a.jobId));

  return (
    <div className="space-y-6">
      <JobsTabs />
      <PageHeader title={t("jobs.savedTitle")} description={t("jobs.savedSub")} />

      {searches.length > 0 && (
        <section>
          <h2 className="mb-3 font-display font-semibold">{t("jobs.savedSearches")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searches.map((s) => (
              <div key={s.id} className="surface flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
                  {s.alertsEnabled ? <Bell className="size-4" /> : <Search className="size-4" />}
                </span>
                <Link href={`/jobs${toQueryString(s.params as Record<string, unknown>)}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold hover:underline">{s.name}</div>
                  <div className="text-xs text-fg-muted">{s.alertsEnabled ? t("jobs.alertsOn") : t("jobs.runSearch")}</div>
                </Link>
                <DeleteSavedSearch id={s.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display font-semibold">{t("jobs.savedJobs", { n: jobs.length })}</h2>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<Bookmark />}
            title={t("jobs.noSaved")}
            description={t("jobs.noSavedBody")}
            action={
              <Link href="/jobs" className={buttonClasses({ pill: true })}>
                {t("jobs.browse")}
              </Link>
            }
          />
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={{ ...job, match: matches.get(job.id), saved: true, applied: appliedSet.has(job.id) }} signedIn />)
        )}
      </section>
    </div>
  );
}
