"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { BadgeCheck, CheckCircle2, MapPin, Megaphone, Star, Users } from "lucide-react";
import type { JobCardWithMatch } from "@/server/services/jobs";
import { CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MatchHighlights } from "@/components/match/match-breakdown";
import { MatchButton, SaveJobButton } from "@/components/jobs/job-actions";
import { cn } from "@/lib/utils";

export function JobCard({
  job,
  signedIn,
  placement,
  className,
}: {
  job: JobCardWithMatch;
  signedIn: boolean;
  placement?: "sponsored";
  className?: string;
}) {
  const { t, f } = useI18n();
  const now = Date.now();
  const featured = !!job.featuredUntil && job.featuredUntil.getTime() > now;
  const salary = f.salary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const location = job.workMode === "REMOTE" ? t("common.remote") : f.location(job.city, job.countryCode);
  return (
    <article
      className={cn(
        "surface surface-hover group relative p-5",
        placement === "sponsored" && "ring-1 ring-aurora/30",
        featured && placement !== "sponsored" && "ring-1 ring-ember/35",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <CompanyLogo name={job.company.name} src={job.company.logoUrl} color={job.company.brandColor} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {placement === "sponsored" && (
              <Badge tone="aurora" size="xs">
                <Megaphone /> {t("common.sponsored")}
              </Badge>
            )}
            {featured && placement !== "sponsored" && (
              <Badge tone="ember" size="xs">
                <Star /> {t("common.featured")}
              </Badge>
            )}
            {job.applied && (
              <Badge tone="mint" size="xs">
                <CheckCircle2 /> {t("common.applied")}
              </Badge>
            )}
          </div>
          <h3 className="mt-0.5 font-display text-[16px] font-semibold leading-snug">
            <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 after:rounded-[1.125rem] focus-visible:outline-none">
              {job.title}
            </Link>
          </h3>
          <div className="mt-0.5 flex items-center gap-1 text-sm text-fg-muted">
            {job.company.name}
            {job.company.verified && <BadgeCheck className="size-3.5 text-brand" aria-label={t("common.verified")} />}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {job.match && <MatchButton match={job.match} title={`${job.title} · ${job.company.name}`} />}
          <SaveJobButton jobId={job.id} saved={!!job.saved} signedIn={signedIn} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-fg-muted sm:ps-[60px]">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" /> {location}
        </span>
        {job.workMode !== "REMOTE" && (
          <>
            <span className="text-border-strong">•</span>
            <span>{t(`enums.workMode.${job.workMode}`)}</span>
          </>
        )}
        <span className="text-border-strong">•</span>
        <span>{t(`enums.employmentType.${job.employmentType}`)}</span>
        <span className="text-border-strong">•</span>
        <span>{t(`enums.experienceLevel.${job.experienceLevel}`)}</span>
        {salary && (
          <>
            <span className="text-border-strong">•</span>
            <span className="font-medium text-fg">{salary}</span>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:ps-[60px]">
        {job.match ? (
          <MatchHighlights match={job.match} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 4).map((s) => (
              <span key={s.skillId} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">
                {s.skill.name}
              </span>
            ))}
          </div>
        )}
        <span className="inline-flex items-center gap-2 text-xs text-fg-subtle" suppressHydrationWarning>
          {job.publishedAt && f.shortTimeAgo(job.publishedAt)}
          {job.applicationCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {job.applicationCount}
            </span>
          )}
        </span>
      </div>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="surface p-5">
      <div className="flex gap-4">
        <div className="skeleton size-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      <div className="skeleton ms-[60px] mt-4 h-3 w-3/4" />
    </div>
  );
}
