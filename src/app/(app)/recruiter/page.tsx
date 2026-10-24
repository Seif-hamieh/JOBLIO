import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, Eye, Megaphone, Plus, Search, Star, Users, UserPlus } from "lucide-react";
import { requireRecruiter } from "@/server/session";
import { recruiterDashboard } from "@/server/services/recruiter";
import { JobRowActions } from "@/components/recruiter/job-row-actions";
import { MatchPill } from "@/components/match/match-ring";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { AnimatedNumber, ProgressBar, Reveal } from "@/components/ui/motion";
import { LocalTime } from "@/components/ui/local-time";
import { buttonClasses } from "@/components/ui/button";
import { PIPELINE_STAGES } from "@/lib/constants";

export const generateMetadata = pageTitle("nav.recruiterDashboard");

export default async function RecruiterDashboardPage() {
  const [viewer, { t, f }] = await Promise.all([requireRecruiter(), getI18n()]);
  const d = await recruiterDashboard(viewer.company.id);
  const open = d.jobs.filter((j) => j.status === "OPEN");
  const inPipeline = PIPELINE_STAGES.reduce((s, k) => s + (d.byStage[k] ?? 0), 0);
  const now = new Date();

  const stats = [
    { label: t("recruiter.statActive"), value: open.length, icon: Briefcase },
    { label: t("recruiter.statPipeline"), value: inPipeline, icon: Users },
    { label: t("recruiter.statNew"), value: d.newApplicants, icon: UserPlus },
    { label: t("recruiter.statInterviews"), value: d.upcomingInterviews.length, icon: CalendarClock },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.05}>
            <Card className="p-5">
              <div className="flex items-center justify-between text-sm text-fg-muted">
                {s.label}
                <span className="grid size-8 place-items-center rounded-lg border border-border bg-surface-2">
                  <s.icon className="size-4 text-brand" />
                </span>
              </div>
              <div className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] tabular-nums">
                <AnimatedNumber value={s.value} />
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <Card className="p-6">
        <CardHeader title={t("recruiter.pipelineTitle")} description={t("recruiter.pipelineSub")} />
        {/* Three columns on phones: five would squeeze each stage name into its count. */}
        <div className="mt-5 grid grid-cols-3 gap-x-5 gap-y-4 sm:grid-cols-5 sm:gap-x-3">
          {PIPELINE_STAGES.map((s) => (
            <div key={s} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium text-fg-muted">{t(`enums.pipelineStage.${s}`)}</span>
                <span className="shrink-0 font-display text-lg font-semibold tabular-nums">{d.byStage[s] ?? 0}</span>
              </div>
              <ProgressBar value={inPipeline ? ((d.byStage[s] ?? 0) / inPipeline) * 100 : 0} tone={s === "HIRED" ? "mint" : "brand"} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-3">
            <CardHeader title={t("recruiter.jobsCount", { n: d.jobs.length })} />
            <Link href="/recruiter/jobs/new" className={buttonClasses({ size: "sm", variant: "soft", pill: true })}>
              <Plus /> {t("recruiter.newJob")}
            </Link>
          </div>
          {d.jobs.length === 0 ? (
            <div className="p-6 pt-0">
              <EmptyState icon={<Briefcase />} title={t("recruiter.firstJob")} description={t("recruiter.firstJobBody")} action={<Link href="/recruiter/jobs/new" className={buttonClasses({ pill: true })}>{t("recruiter.postJob")}</Link>} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-surface-2 text-start text-xs text-fg-muted">
                    <th className="px-6 py-2.5 text-start font-semibold">{t("recruiter.role")}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{t("common.status")}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{t("recruiter.views")}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{t("recruiter.applicants")}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{t("recruiter.newCol")}</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.jobs.map((j) => (
                    <tr key={j.id} className="transition-colors hover:bg-surface-2/60">
                      <td className="px-6 py-3.5">
                        <Link href={`/recruiter/jobs/${j.id}/pipeline`} className="font-medium hover:underline">
                          {j.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-subtle">
                          {t(`enums.workMode.${j.workMode}`)}
                          {j.city ? ` · ${j.city}` : ""}
                          {j.publishedAt ? ` · ${f.shortTimeAgo(j.publishedAt)}` : ""}
                          {j.featuredUntil && j.featuredUntil > now && (
                            <Badge tone="ember" size="xs">
                              <Star /> {t("common.featured")}
                            </Badge>
                          )}
                          {j.sponsoredUntil && j.sponsoredUntil > now && (
                            <Badge tone="aurora" size="xs">
                              <Megaphone /> {t("common.sponsored")}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={j.status === "OPEN" ? "mint" : j.status === "DRAFT" ? "neutral" : j.status === "PAUSED" ? "ember" : "danger"}>{t(`enums.jobStatus.${j.status}`)}</Badge>
                      </td>
                      <td className="px-3 py-3.5 text-end tabular-nums text-fg-muted">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" /> {j.viewCount}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-end font-medium tabular-nums">{j.applicationCount}</td>
                      <td className="px-3 py-3.5 text-end tabular-nums">{j._count.applications > 0 ? <span className="font-semibold text-brand-soft-fg">{j._count.applications}</span> : <span className="text-fg-subtle">0</span>}</td>
                      <td className="px-3 py-3.5 text-end">
                        <JobRowActions jobId={j.id} status={j.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <CardHeader title={t("recruiter.topApplicants")} description={t("recruiter.rankedByMatch")} />
            <ul className="mt-4 space-y-3">
              {d.recent.length === 0 && <li className="text-sm text-fg-muted">{t("recruiter.noApplicants")}</li>}
              {d.recent.map((a) => (
                <li key={a.id}>
                  <Link href={`/recruiter/jobs/${a.jobId}/pipeline?a=${a.id}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-surface-2">
                    <Avatar name={a.applicant.name} src={a.applicant.image} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{a.applicant.name}</div>
                      <div className="truncate text-xs text-fg-muted">{a.job.title}</div>
                    </div>
                    <MatchPill score={a.matchScore} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <CardHeader
              title={t("recruiter.upcoming")}
              action={
                <Link href="/interviews" className="text-xs font-medium text-brand-soft-fg hover:underline">
                  {t("home.all")}
                </Link>
              }
            />
            <ul className="mt-4 space-y-3">
              {d.upcomingInterviews.length === 0 && <li className="text-sm text-fg-muted">{t("recruiter.nothingScheduled")}</li>}
              {d.upcomingInterviews.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <Avatar name={i.application.applicant.name} src={i.application.applicant.image} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.application.applicant.name}</div>
                    <div className="truncate text-xs text-fg-muted">
                      <LocalTime date={i.startsAt} /> · {t(`enums.interviewType.${i.type}`)}
                    </div>
                  </div>
                  <Badge size="xs" tone={i.candidateResponse === "ACCEPTED" ? "mint" : i.candidateResponse === "DECLINED" ? "danger" : "ember"}>
                    {i.candidateResponse === "PENDING" ? t("recruiter.pending") : i.candidateResponse === "ACCEPTED" ? t("interviews.confirmed") : t("interviews.declined")}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Link href="/recruiter/candidates" className="surface surface-hover flex items-center gap-3 p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-brand text-brand-fg">
              <Search className="size-5" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t("recruiter.searchCandidates")}</div>
              <div className="text-xs text-fg-muted">{t("recruiter.searchCandidatesSub")}</div>
            </div>
            <ArrowRight className="size-4 text-fg-muted" />
          </Link>
        </div>
      </div>
    </div>
  );
}
