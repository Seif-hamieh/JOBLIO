import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Phone, Video } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { InterviewResponse } from "@/components/applications/application-actions";
import { InterviewStatusMenu } from "@/components/recruiter/interview-status";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { safeExternalUrl } from "@/lib/utils";
import { LocalTime } from "@/components/ui/local-time";

export const generateMetadata = pageTitle("interviews.title");

const ICON = { VIDEO: Video, PHONE: Phone, ONSITE: MapPin } as const;

function DateBlock({ date }: { date: Date }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl border border-border bg-surface-2/60 py-2">
      <LocalTime date={date} format="month" className="text-[11px] font-semibold uppercase text-brand-soft-fg" />
      <LocalTime date={date} format="day" className="font-display text-2xl font-semibold leading-none" />
      <LocalTime date={date} format="weekday" className="mt-0.5 text-[11px] text-fg-subtle" />
    </div>
  );
}

export default async function InterviewsPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const now = new Date();
  const [mine, team] = await Promise.all([
    db.interview.findMany({
      where: { application: { applicantId: viewer.id } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true, startsAt: true, durationMinutes: true, type: true, location: true, meetingUrl: true, notes: true, status: true, candidateResponse: true,
        scheduledBy: { select: { name: true, image: true } },
        application: { select: { job: { select: { id: true, title: true, company: { select: { name: true, logoUrl: true, brandColor: true } } } } } },
      },
    }),
    viewer.company
      ? db.interview.findMany({
          where: { application: { job: { companyId: viewer.company.id } }, startsAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
          orderBy: { startsAt: "asc" },
          take: 50,
          select: {
            id: true, startsAt: true, durationMinutes: true, type: true, status: true, candidateResponse: true, meetingUrl: true, location: true,
            application: { select: { id: true, applicant: { select: { name: true, image: true, username: true } }, job: { select: { id: true, title: true } } } },
          },
        })
      : [],
  ]);
  const upcoming = mine.filter((i) => i.startsAt >= now && i.status === "SCHEDULED");
  const past = mine.filter((i) => !(i.startsAt >= now && i.status === "SCHEDULED"));

  return (
    <div className="space-y-6">
      <JobsTabs />
      <PageHeader title={t("interviews.title")} description={t("interviews.sub")} />

      {mine.length === 0 && team.length === 0 && (
        <EmptyState icon={<CalendarDays />} title={t("interviews.none")} description={t("interviews.noneBody")} />
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display font-semibold">{t("interviews.upcoming")}</h2>
          {upcoming.map((i) => {
            const Icon = ICON[i.type];
            const link = safeExternalUrl(i.meetingUrl);
            return (
              <article key={i.id} className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <DateBlock date={i.startsAt} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CompanyLogo name={i.application.job.company.name} src={i.application.job.company.logoUrl} color={i.application.job.company.brandColor} size="sm" />
                    <Link href={`/jobs/${i.application.job.id}`} className="font-semibold hover:underline">
                      {i.application.job.title}
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4" />
                      <LocalTime date={i.startsAt} format="time" /> · {t("interviews.min", { n: i.durationMinutes })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-4" /> {t(`enums.interviewType.${i.type}`)}
                    </span>
                    {i.location && <span>{i.location}</span>}
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={i.scheduledBy.name} src={i.scheduledBy.image} size="xs" /> {i.scheduledBy.name}
                    </span>
                  </div>
                  {i.notes && <p className="mt-2 text-sm text-fg-muted">{i.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {link && i.candidateResponse === "ACCEPTED" && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-fg">
                      {t("interviews.join")}
                    </a>
                  )}
                  <InterviewResponse interviewId={i.id} response={i.candidateResponse} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      {team.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display font-semibold">{t("interviews.team", { company: viewer.company!.name })}</h2>
          <div className="surface divide-y divide-border">
            {team.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-4 p-4">
                <DateBlock date={i.startsAt} />
                <Avatar name={i.application.applicant.name} src={i.application.applicant.image} />
                <div className="min-w-0 flex-1">
                  <Link href={`/recruiter/candidates/${i.application.applicant.username}`} className="text-sm font-semibold hover:underline">
                    {i.application.applicant.name}
                  </Link>
                  <div className="text-xs text-fg-muted">
                    {i.application.job.title} · <LocalTime date={i.startsAt} format="time" /> · {t(`enums.interviewType.${i.type}`)}
                  </div>
                </div>
                <Badge tone={i.status === "CANCELLED" ? "danger" : i.status === "COMPLETED" ? "neutral" : i.candidateResponse === "ACCEPTED" ? "mint" : i.candidateResponse === "DECLINED" ? "danger" : "ember"}>
                  {i.status === "SCHEDULED" ? (i.candidateResponse === "PENDING" ? t("interviews.awaiting") : i.candidateResponse === "ACCEPTED" ? t("interviews.confirmed") : t("interviews.declined")) : i.status === "COMPLETED" ? t("interviews.completed") : t("interviews.cancelled")}
                </Badge>
                {i.status === "SCHEDULED" && <InterviewStatusMenu interviewId={i.id} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display font-semibold text-fg-muted">{t("interviews.past")}</h2>
          <div className="surface divide-y divide-border">
            {past.map((i) => (
              <div key={i.id} className="flex items-center gap-4 p-4 opacity-80">
                <DateBlock date={i.startsAt} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{i.application.job.title}</div>
                  <div className="text-fg-muted">{i.application.job.company.name}</div>
                </div>
                <Badge>{i.status === "CANCELLED" ? t("interviews.cancelled") : i.candidateResponse === "DECLINED" ? t("interviews.declined") : t("interviews.completed")}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
