import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Info, Star } from "lucide-react";
import { getViewer } from "@/server/session";
import { featuredJobs } from "@/server/services/jobs";
import { JobCard } from "@/components/jobs/job-card";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("jobs.featuredTitle");

export default async function FeaturedJobsPage() {
  const [viewer, { t }] = await Promise.all([getViewer(), getI18n()]);
  const jobs = await featuredJobs(viewer?.id ?? null, 40);
  const now = Date.now();
  return (
    <div className="space-y-6">
      {viewer && <JobsTabs />}
      <PageHeader
        eyebrow={t("jobs.featuredEyebrow")}
        title={t("jobs.featuredTitle")}
        description={t("jobs.featuredSub")}
        actions={
          viewer?.company ? (
            <Link href="/recruiter" className={buttonClasses({ variant: "outline", pill: true })}>
              <Star /> {t("jobs.featureAJob")}
            </Link>
          ) : undefined
        }
      />
      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">
        <Info className="mt-0.5 size-4 shrink-0" /> {t("jobs.featuredNote")}
      </p>
      {jobs.length === 0 ? (
        <EmptyState icon={<Star />} title={t("jobs.noFeatured")} description={t("jobs.noFeaturedBody")} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} signedIn={!!viewer} placement={job.sponsoredUntil && job.sponsoredUntil.getTime() > now && !job.featuredUntil ? "sponsored" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
