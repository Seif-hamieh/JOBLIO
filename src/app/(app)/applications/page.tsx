import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { CalendarClock, FileText, Send, Video } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { getCandidateFacts, jobMatchSelect, toJobFacts } from "@/server/services/matching";
import { computeMatch } from "@/lib/matching/engine";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { StatusTracker } from "@/components/applications/status-tracker";
import { Expandable, WithdrawButton } from "@/components/applications/application-actions";
import { CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { NavTabs } from "@/components/ui/controls";
import { MatchPill } from "@/components/match/match-ring";
import type { ApplicationStatus } from "@/lib/constants";
import { LocalTime } from "@/components/ui/local-time";

export const generateMetadata = pageTitle("applications.title");

const CLOSED: ApplicationStatus[] = ["REJECTED", "WITHDRAWN", "HIRED"];

export default async function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const { view } = await searchParams;
  const archived = view === "archived";
  const [apps, facts] = await Promise.all([db.application.findMany({
    where: { applicantId: viewer.id, status: archived ? { in: CLOSED } : { notIn: CLOSED } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      matchScore: true,
      createdAt: true,
      updatedAt: true,
      resumeUrl: true,
      job: { select: { ...jobMatchSelect, id: true, title: true, workMode: true, company: { select: { name: true, logoUrl: true, brandColor: true, slug: true } } } },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, toStatus: true, createdAt: true } },
      interviews: { where: { status: "SCHEDULED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, type: true } },
    },
  }), getCandidateFacts(viewer.id)]);
  // The same live, job-seeker score as the job page and job lists (the stored matchScore is the
  // recruiter-side snapshot taken when the application was sent).
  const liveScore = (a: (typeof apps)[number]) => (facts ? computeMatch(facts, toJobFacts(a.job)).score : a.matchScore);
  const counts = await db.application.groupBy({ by: ["status"], where: { applicantId: viewer.id }, _count: true });
  const activeCount = counts.filter((c) => !CLOSED.includes(c.status)).reduce((s, c) => s + c._count, 0);
  const archivedCount = counts.filter((c) => CLOSED.includes(c.status)).reduce((s, c) => s + c._count, 0);

  return (
    <div className="space-y-6">
      <JobsTabs />
      <PageHeader title={t("applications.title")} description={t("applications.sub")} />
      <NavTabs
        layoutId="apps-tabs"
        tabs={[
          { href: "/applications", label: t("applications.active", { n: activeCount }), exact: true },
          { href: "/applications?view=archived", label: t("applications.closed", { n: archivedCount }), exact: true },
        ]}
      />

      {apps.length === 0 ? (
        <EmptyState
          icon={<Send />}
          title={archived ? t("applications.noneArchived") : t("applications.noneActive")}
          description={archived ? t("applications.archivedBody") : t("applications.activeBody")}
          action={
            <Link href="/jobs/for-you" className={buttonClasses({ pill: true })}>
              {t("applications.findForYou")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <article key={a.id} className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start gap-4">
                <CompanyLogo name={a.job.company.name} src={a.job.company.logoUrl} color={a.job.company.brandColor} />
                <div className="min-w-0 flex-1">
                  <Link href={`/jobs/${a.job.id}`} className="font-display font-semibold hover:underline">
                    {a.job.title}
                  </Link>
                  <div className="text-sm text-fg-muted">
                    <Link href={`/companies/${a.job.company.slug}`} className="hover:underline">
                      {a.job.company.name}
                    </Link>{" "}
                    · {t("applications.appliedAgo", { when: f.timeAgo(a.createdAt) })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MatchPill score={liveScore(a)} />
                  <Badge tone={a.status === "REJECTED" ? "danger" : a.status === "OFFER" || a.status === "HIRED" ? "mint" : a.status === "WITHDRAWN" ? "neutral" : "brand"}>
                    {t(`enums.applicationStatus.${a.status}`)}
                  </Badge>
                </div>
              </div>

              <div className="mt-6 sm:px-2">
                <StatusTracker status={a.status} reached={a.events.map((e) => e.toStatus)} />
              </div>

              {a.interviews[0] && (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-brand-soft/60 px-4 py-3 text-sm">
                  {a.interviews[0].type === "VIDEO" ? <Video className="size-4 text-brand" /> : <CalendarClock className="size-4 text-brand" />}
                  <span>
                    <span className="font-semibold">{t(`enums.interviewType.${a.interviews[0].type}`)}</span> · <LocalTime date={a.interviews[0].startsAt} />
                  </span>
                  <Link href="/interviews" className="ms-auto text-xs font-semibold text-brand-soft-fg hover:underline">
                    {t("applications.details")}
                  </Link>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Expandable label={t("applications.activity")}>
                  <ol className="mt-3 space-y-2 border-s border-border ps-4">
                    {a.events.map((e) => (
                      <li key={e.id} className="relative text-sm">
                        <span className="absolute -start-[21px] top-1.5 size-2 rounded-full bg-brand" />
                        <span className="font-medium">{t(`enums.applicationStatus.${e.toStatus}`)}</span>
                        <span className="text-fg-subtle"> · {f.timeAgo(e.createdAt)}</span>
                      </li>
                    ))}
                  </ol>
                </Expandable>
                <div className="flex items-center gap-2">
                  {a.resumeUrl && (
                    <a href={a.resumeUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                      <FileText /> {t("jobs.cv")}
                    </a>
                  )}
                  {!CLOSED.includes(a.status) && <WithdrawButton applicationId={a.id} jobTitle={a.job.title} />}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
