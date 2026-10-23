import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  Clock,
  ExternalLink,
  Eye,
  Gift,
  GraduationCap,
  Languages,
  MapPin,
  MessageSquare,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { getViewer } from "@/server/session";
import { canFeatureJob, featuredJobPlanOptions, paddleClientConfig } from "@/server/paddle";
import { FeatureJobButton } from "@/components/jobs/feature-job-button";
import { jobPostingJsonLd, jsonLdScript } from "@/lib/job-posting-ld";
import { anonymousViewerKey, expirePromotions, getJob, isBotRequest, recordJobView, similarJobs } from "@/server/services/jobs";
import { getCandidateFacts, toJobFacts } from "@/server/services/matching";
import { db } from "@/server/db";
import { computeMatch } from "@/lib/matching/engine";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { SOURCE_NAMES } from "@/server/job-import/normalize";
import { Card, CardHeader } from "@/components/ui/misc";
import { ApplyButton } from "@/components/jobs/apply-dialog";
import { ReportJobButton } from "@/components/jobs/report-job-button";
import { SaveJobButton, ShareButton } from "@/components/jobs/job-actions";
import { JobCard } from "@/components/jobs/job-card";
import { MatchBreakdown } from "@/components/match/match-breakdown";
import { FollowCompanyButton } from "@/components/companies/follow-button";
import { Reveal } from "@/components/ui/motion";
import { SKILL_RANK } from "@/lib/constants";
import { hostname, safeExternalUrl, APP_URL } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { industryName } from "@/i18n/translate";

// A bad link (e.g. "/jobs/undefined") answers 404 without querying the database.
const isJobId = (id: string | undefined): id is string => !!id && id !== "undefined" && id !== "null" && id.length <= 64;

const clip = (s: string | null | undefined, n = 160) => (s ? (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s).replace(/\s+/g, " ") : undefined);

// Missing (or closed, for outsiders) jobs 404 here too: metadata is resolved before streaming
// for crawlers, so they get a real 404 status instead of a 200 "not found" page.
export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isJobId(id)) notFound();
  const [job, viewer, { t }] = await Promise.all([
    db.job.findUnique({ where: { id }, select: { title: true, summary: true, description: true, status: true, companyId: true, company: { select: { name: true } } } }),
    getViewer(),
    getI18n(),
  ]);
  if (!job) notFound();
  if (job.status !== "OPEN" && !viewer?.isAdmin) {
    const member = viewer && (await db.companyMember.findUnique({ where: { companyId_userId: { companyId: job.companyId, userId: viewer.id } }, select: { id: true } }));
    if (!member) notFound();
  }
  const title = t("meta.jobAt", { job: job.title, company: job.company.name });
  const description = clip(job.summary || job.description);
  return { title, description, openGraph: { type: "website", siteName: "JOBLIO", title, description } };
}

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  if (!isJobId(id)) notFound();
  await expirePromotions(); // also closes jobs past their closing day (throttled)
  const [job, viewer, { t, f }] = await Promise.all([getJob(id), getViewer(), getI18n()]);
  if (!job) notFound();
  // Members of the posting company manage the job instead of applying to it (any of their companies, not just the first).
  const isTeam =
    !!viewer &&
    (viewer.company?.id === job.company.id ||
      !!(await db.companyMember.findUnique({ where: { companyId_userId: { companyId: job.company.id, userId: viewer.id } }, select: { id: true } })));
  // Admins can open drafts too (to review imported jobs before publishing).
  if (job.status !== "OPEN" && !isTeam && !viewer?.isAdmin) notFound();
  // "Feature this job" (Paddle): the poster or a company admin, open jobs that are not featured yet.
  const paddleConfig = paddleClientConfig();
  const showFeature = !!paddleConfig && canFeatureJob(viewer, { companyId: job.company.id, postedById: job.postedBy.id, status: job.status, featuredUntil: job.featuredUntil });

  const [facts, saved, application, follows, similar, resume] = await Promise.all([
    viewer ? getCandidateFacts(viewer.id) : null,
    viewer ? db.savedJob.findUnique({ where: { userId_jobId: { userId: viewer.id, jobId: id } } }) : null,
    viewer ? db.application.findUnique({ where: { jobId_applicantId: { jobId: id, applicantId: viewer.id } }, select: { status: true } }) : null,
    viewer ? db.companyFollower.findUnique({ where: { userId_companyId: { userId: viewer.id, companyId: job.company.id } } }) : null,
    similarJobs(job, viewer?.id ?? null),
    viewer ? db.profile.findUnique({ where: { userId: viewer.id }, select: { resumeUrl: true, resumeName: true } }) : null,
  ]);
  // Crawlers aren't counted (and skip the database writes).
  if (!isTeam && (viewer || !(await isBotRequest()))) await recordJobView(id, viewer?.id ?? (await anonymousViewerKey()));

  const match = facts ? computeMatch(facts, toJobFacts(job)) : null;
  const held = new Map(facts?.skills.map((s) => [s.skillId, s.level]) ?? []);
  const applied = !!application && application.status !== "WITHDRAWN";
  const salary = f.salary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const location = job.workMode === "REMOTE" ? t("common.remote") : f.location(job.city, job.countryCode);
  const website = safeExternalUrl(job.company.website);
  const required = job.skills.filter((s) => s.required);
  const preferred = job.skills.filter((s) => !s.required);

  const applyProps = {
    job: { id: job.id, title: job.title, companyName: job.company.name },
    applicant: viewer ? { name: viewer.name, image: viewer.image, headline: viewer.headline } : null,
    savedResume: resume?.resumeUrl ? { name: resume.resumeName ?? "CV" } : null,
    matchScore: match?.score ?? null,
    signedIn: !!viewer,
    applied,
  };
  // Imported listings (Arbeitnow, Jobicy, Himalayas): their terms require applying on the original
  // listing and crediting the source, so the Apply button links there instead of opening our form.
  const external = job.externalUrl && job.externalSource ? { url: job.externalUrl, source: SOURCE_NAMES[job.externalSource] } : null;
  const applyAction = (size: "md" | "lg", className?: string) =>
    external ? (
      <a href={external.url} target="_blank" rel="noopener noreferrer nofollow" className={buttonClasses({ size, className })}>
        {t("jobs.applyOnSource", { source: external.source })} <ExternalLink />
      </a>
    ) : (
      <ApplyButton {...applyProps} size={size} className={className} />
    );

  const facts_ = [
    { icon: MapPin, label: t("jobs.location"), value: location },
    { icon: Briefcase, label: t("jobs.jobType"), value: `${t(`enums.employmentType.${job.employmentType}`)} · ${t(`enums.workMode.${job.workMode}`)}` },
    { icon: Clock, label: t("jobs.experience"), value: `${t(`enums.experienceLevel.${job.experienceLevel}`)}${job.minYearsExperience ? ` · ${t("jobs.minExperience", { years: f.years(job.minYearsExperience) })}` : ""}` },
    { icon: Wallet, label: t("jobs.salary"), value: salary ?? t("jobs.notDisclosed") },
    { icon: GraduationCap, label: t("jobs.education"), value: t(`enums.educationLevel.${job.educationLevel}`) },
  ];

  return (
    <div className="pb-24 md:pb-0">
      {job.status === "OPEN" && !job.externalSource && (
        // Structured data for search engines (Google for Jobs). Never for imported listings: their
        // sources forbid passing them on to Google Jobs (Himalayas' terms say so explicitly).
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jobPostingJsonLd(job, APP_URL)) }} />
      )}
      <Link href="/jobs" className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("jobs.allJobs")}
      </Link>

      {/* Header */}
      <section className="surface relative overflow-hidden">
        <div
          className="h-24 sm:h-28"
          style={{
            background: job.company.brandColor
              ? `linear-gradient(120deg, ${job.company.brandColor}, color-mix(in oklch, ${job.company.brandColor} 55%, var(--aurora)))`
              : "linear-gradient(120deg, var(--brand), var(--aurora))",
          }}
        />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <CompanyLogo name={job.company.name} src={job.company.logoUrl} color={job.company.brandColor} size="xl" className="ring-4 ring-surface" />
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <SaveJobButton jobId={job.id} saved={!!saved} signedIn={!!viewer} variant="button" />
              <ShareButton title={`${job.title} · ${job.company.name}`} path={`/jobs/${job.id}`} />
              {isTeam ? (
                <Link href={`/recruiter/jobs/${job.id}/pipeline`} className={buttonClasses({ size: "lg" })}>
                  {t("jobs.openPipeline")}
                </Link>
              ) : (
                applyAction("lg")
              )}
            </div>
          </div>
          {showFeature && paddleConfig && (
            <div className="mt-4 space-y-3 rounded-2xl border border-ember/30 bg-ember-soft p-4">
              <div>
                <h2 className="text-sm font-semibold">{t("jobs.featureTitle")}</h2>
                <p className="mt-0.5 text-sm text-fg-muted">{t("jobs.featureHint")}</p>
              </div>
              <FeatureJobButton jobId={job.id} config={paddleConfig} plans={featuredJobPlanOptions()} />
            </div>
          )}
          <div className="mt-4">
            <div className="flex flex-wrap gap-1.5">
              {job.status !== "OPEN" && <Badge tone="danger">{t(`enums.jobStatus.${job.status}`)}</Badge>}
              {job.featuredUntil && job.featuredUntil > new Date() && <Badge tone="ember">{t("common.featured")}</Badge>}
              {job.sponsoredUntil && job.sponsoredUntil > new Date() && <Badge tone="aurora">{t("common.sponsored")}</Badge>}
            </div>
            <h1 className="mt-1 break-words font-display text-2xl font-semibold tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-[32px] sm:leading-tight">{job.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-fg-muted">
              <Link href={`/companies/${job.company.slug}`} className="inline-flex items-center gap-1 font-medium text-fg hover:underline">
                {job.company.name}
                {job.company.verified && <BadgeCheck className="size-4 text-brand" />}
              </Link>
              <span>·</span>
              <span>{location}</span>
              <span>·</span>
              <span className="text-sm">{job.publishedAt ? t("jobs.postedAgo", { when: f.timeAgo(job.publishedAt) }) : t("jobs.notPublished")}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" /> {t("jobs.applicants", { n: job.applicationCount })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-4" /> {t("jobs.views", { n: f.number(job.viewCount) })}
              </span>
              {job.closesAt && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4" /> {t("jobs.closes", { date: f.date(job.closesAt, { month: "short", day: "numeric", year: "numeric" }) })}
                </span>
              )}
              {/* Visitors can flag a fake or broken job; the company's own team doesn't see this. */}
              {!isTeam && job.status === "OPEN" && <ReportJobButton jobId={job.id} className="ms-auto" />}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Key facts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {facts_.map((fact) => (
              <div key={fact.label} className="surface p-4">
                <span className="grid size-8 place-items-center rounded-lg border border-border bg-surface-2">
                  <fact.icon className="size-4 text-brand" />
                </span>
                <div className="mt-3 text-xs text-fg-subtle">{fact.label}</div>
                <div className="mt-0.5 text-sm font-medium leading-snug">{fact.value}</div>
              </div>
            ))}
          </div>

          <Card className="p-6 sm:p-7">
            <h2 className="font-display text-lg font-semibold">{t("jobs.aboutRole")}</h2>
            {external && (
              // Attribution the sources require: name them and link to the original listing.
              <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-fg-muted">
                {t("jobs.sourceAttribution", { source: external.source })} ·
                <a href={external.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-brand-soft-fg hover:underline">
                  {t("jobs.viewOriginal")} <ExternalLink className="size-3" />
                </a>
              </p>
            )}
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fg/80">
              {job.description.split(/\n{2,}/).map((p, i) => (
                <p key={i} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                  {p}
                </p>
              ))}
            </div>

            {job.responsibilities.length > 0 && (
              <>
                <h3 className="mt-7 font-display font-semibold">{t("jobs.whatYoullDo")}</h3>
                <ul className="mt-3 space-y-2.5">
                  {job.responsibilities.map((r) => (
                    <li key={r} className="flex gap-3 text-[15px] text-fg-muted">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{r}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {job.requirements.length > 0 && (
              <>
                <h3 className="mt-7 font-display font-semibold">{t("jobs.lookingFor")}</h3>
                <ul className="mt-3 space-y-2.5">
                  {job.requirements.map((r) => (
                    <li key={r} className="flex gap-3 text-[15px] text-fg-muted">
                      <Check className="mt-1 size-4 shrink-0 text-mint" strokeWidth={2.5} />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{r}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Skills */}
          <Card className="p-6 sm:p-7">
            <CardHeader title={t("jobs.skills")} description={facts ? t("jobs.skillsCompared") : t("jobs.skillsSignIn")} />
            {[
              { title: t("jobs.required"), list: required },
              { title: t("jobs.niceToHave"), list: preferred },
            ].map(
              (group) =>
                group.list.length > 0 && (
                  <div key={group.title} className="mt-5">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{group.title}</div>
                    <div className="flex flex-wrap gap-2">
                      {group.list.map((s) => {
                        const level = held.get(s.skillId);
                        const ok = level && SKILL_RANK[level] >= SKILL_RANK[s.minLevel];
                        return (
                          <span
                            key={s.skillId}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${
                              !facts ? "border-border" : ok ? "border-mint/40 bg-mint-soft text-mint-fg" : level ? "border-ember/40 bg-ember-soft text-ember-fg" : "border-border text-fg-muted"
                            }`}
                          >
                            {facts && (ok ? <Check className="size-3.5" strokeWidth={3} /> : level ? <Clock className="size-3.5" /> : <X className="size-3.5" />)}
                            <Link href={`/jobs?skills=${s.skill.slug}`} className="font-medium hover:underline">
                              {s.skill.name}
                            </Link>
                            <span className="text-xs opacity-80">· {t(`enums.skillLevel.${s.minLevel}`)}+</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ),
            )}
            {job.languages.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                  <Languages className="size-3.5" /> {t("jobs.languages")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.languages.map((l) => (
                    <Badge key={l.languageCode} size="md">
                      {f.language(l.languageCode)} · {t(`enums.proficiency.${l.minProficiency}`)}+
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {job.benefits.length > 0 && (
            <Card className="p-6 sm:p-7">
              <h2 className="font-display text-lg font-semibold">{t("jobs.benefits")}</h2>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {job.benefits.map((b) => (
                  <div key={b} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-sm">
                    <Gift className="size-4 shrink-0 text-ember" /> {b}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {similar.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">{t("jobs.similarTitle")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {similar.map((j) => (
                  <JobCard key={j.id} job={j} signedIn={!!viewer} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-6">
          {match ? (
            <Reveal>
              <Card className="p-6">
                <MatchBreakdown match={match} />
              </Card>
            </Reveal>
          ) : (
            !viewer && (
              <Card className="p-6 text-center">
                <h3 className="font-display font-semibold">{t("jobs.howMatch")}</h3>
                <p className="mt-1.5 text-sm text-fg-muted">{t("jobs.howMatchBody")}</p>
                <Link href="/register" className={buttonClasses({ className: "mt-4 w-full" })}>
                  {t("jobs.getScore")}
                </Link>
              </Card>
            )
          )}

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <CompanyLogo name={job.company.name} src={job.company.logoUrl} color={job.company.brandColor} />
              <div className="min-w-0">
                <Link href={`/companies/${job.company.slug}`} className="font-semibold hover:underline">
                  {job.company.name}
                </Link>
                <div className="truncate text-xs text-fg-muted">{job.company.tagline}</div>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              {job.company.industry && (
                <div className="flex items-center gap-2 text-fg-muted">
                  <Building2 className="size-4" /> {industryName(t, job.company.industry.name)}
                </div>
              )}
              <div className="flex items-center gap-2 text-fg-muted">
                <Users className="size-4" /> {t(`enums.companySize.${job.company.size}`)}
              </div>
              {(job.company.city || job.company.countryCode) && (
                <div className="flex items-center gap-2 text-fg-muted">
                  <MapPin className="size-4" /> {f.location(job.company.city, job.company.countryCode)}
                </div>
              )}
            </dl>
            {job.company.about && <p className="mt-4 line-clamp-4 text-sm text-fg-muted">{job.company.about}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {!isTeam && <FollowCompanyButton companyId={job.company.id} following={!!follows} signedIn={!!viewer} size="sm" />}
              <Link href={`/companies/${job.company.slug}`} className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
                {t("jobs.openRoles", { n: job.company._count.jobs })}
              </Link>
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={buttonClasses({ variant: "ghost", size: "sm", pill: true })}>
                  {hostname(website)}
                </a>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("jobs.hiringTeam")}</div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={job.postedBy.name} src={job.postedBy.image} />
              <div className="min-w-0 flex-1">
                <Link href={`/in/${job.postedBy.username}`} className="text-sm font-semibold hover:underline">
                  {job.postedBy.name}
                </Link>
                <div className="truncate text-xs text-fg-muted">{job.postedBy.profile?.headline}</div>
              </div>
            </div>
            {viewer && viewer.id !== job.postedBy.id && (
              <Link href={`/messages?to=${job.postedBy.id}&job=${job.id}`} className={buttonClasses({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
                <MessageSquare /> {t("common.message")}
              </Link>
            )}
          </Card>

          {isTeam && (
            <Card className="border-brand/30 p-6">
              <div className="text-sm font-semibold">{t("jobs.onTeam")}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/recruiter/jobs/${job.id}/pipeline`} className={buttonClasses({ size: "sm" })}>
                  {t("jobs.openPipeline")}
                </Link>
                <Link href={`/recruiter/jobs/${job.id}/edit`} className={buttonClasses({ size: "sm", variant: "outline" })}>
                  {t("jobs.editJob")}
                </Link>
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* Mobile sticky actions */}
      <div
        className={`glass fixed inset-x-0 z-30 flex items-center gap-2 border-t border-border p-3 md:hidden ${viewer ? "bottom-[calc(64px+env(safe-area-inset-bottom))]" : "bottom-0"}`}
      >
        <SaveJobButton jobId={job.id} saved={!!saved} signedIn={!!viewer} />
        {isTeam ? (
          <Link href={`/recruiter/jobs/${job.id}/pipeline`} className={buttonClasses({ size: "md", className: "flex-1" })}>
            {t("jobs.openPipeline")}
          </Link>
        ) : (
          applyAction("md", "flex-1")
        )}
      </div>
    </div>
  );
}
