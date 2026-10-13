import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { db } from "@/server/db";
import { InterviewStatusMenu } from "@/components/recruiter/interview-status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";

export function DateBlock({ date }: { date: Date }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl border border-border bg-surface-2/60 py-2">
      <LocalTime date={date} format="month" className="text-[11px] font-semibold uppercase text-brand-soft-fg" />
      <LocalTime date={date} format="day" className="font-display text-2xl font-semibold leading-none" />
      <LocalTime date={date} format="weekday" className="mt-0.5 text-[11px] text-fg-subtle" />
    </div>
  );
}

/** Interviews scheduled by a company's team (last 7 days and upcoming). */
export function teamInterviews(companyId: string) {
  return db.interview.findMany({
    where: { application: { job: { companyId: companyId } }, startsAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    take: 50,
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      type: true,
      status: true,
      candidateResponse: true,
      meetingUrl: true,
      location: true,
      application: { select: { id: true, applicant: { select: { name: true, image: true, username: true } }, job: { select: { id: true, title: true } } } },
    },
  });
}

export async function TeamInterviewList({ items, heading }: { items: Awaited<ReturnType<typeof teamInterviews>>; heading?: string }) {
  const { t } = await getI18n();
  if (!items.length) return null;
  const team = items;
  return (
    <section className="space-y-3">
      {heading && <h2 className="font-display font-semibold">{heading}</h2>}
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
            <Badge
              tone={
                i.status === "CANCELLED"
                  ? "danger"
                  : i.status === "COMPLETED"
                    ? "neutral"
                    : i.candidateResponse === "ACCEPTED"
                      ? "mint"
                      : i.candidateResponse === "DECLINED"
                        ? "danger"
                        : "ember"
              }
            >
              {i.status === "SCHEDULED"
                ? i.candidateResponse === "PENDING"
                  ? t("interviews.awaiting")
                  : i.candidateResponse === "ACCEPTED"
                    ? t("interviews.confirmed")
                    : t("interviews.declined")
                : i.status === "COMPLETED"
                  ? t("interviews.completed")
                  : t("interviews.cancelled")}
            </Badge>
            {i.status === "SCHEDULED" && <InterviewStatusMenu interviewId={i.id} />}
          </div>
        ))}
      </div>
    </section>
  );
}
