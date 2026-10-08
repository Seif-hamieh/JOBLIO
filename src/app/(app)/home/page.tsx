import { getI18n, pageTitle } from "@/i18n/server";
import { renderNotification } from "@/server/services/notifications";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bell, Bookmark, Briefcase, CalendarClock, Eye, KanbanSquare, Sparkles, Users } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { jobsForYou } from "@/server/services/jobs";
import { relationStates, suggestions } from "@/server/services/network";
import { JobCard } from "@/components/jobs/job-card";
import { PersonCard } from "@/components/network/person-card";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { CareerJourney } from "@/components/profile/career-journey";
import { AchievementBadge } from "@/components/profile/achievement-badge";
import { Bars } from "@/components/charts/bars";
import { Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { AnimatedNumber, Reveal } from "@/components/ui/motion";
import { LocalTime } from "@/components/ui/local-time";
import { buttonClasses } from "@/components/ui/button";
import { APPLICATION_TRACK } from "@/lib/constants";
import { ACHIEVEMENT_CODES, type AchievementCode } from "@/lib/achievements";
import { buildJourney } from "@/lib/journey";

export const generateMetadata = pageTitle("nav.home");

export default async function HomePage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  if (viewer.intent === "RECRUITER" && viewer.company) redirect("/recruiter");

  const since14 = new Date(Date.now() - 13 * 86_400_000);
  since14.setHours(0, 0, 0, 0);
  const [jobs, appCounts, nextInterview, savedCount, views, notifications, people, achievements, journeyData, hiring] = await Promise.all([
    jobsForYou(viewer.id, { limit: 4, minScore: 50 }),
    db.application.groupBy({ by: ["status"], where: { applicantId: viewer.id }, _count: true }),
    db.interview.findFirst({
      where: { application: { applicantId: viewer.id }, status: "SCHEDULED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, application: { select: { job: { select: { title: true, company: { select: { name: true } } } } } } },
    }),
    db.savedJob.count({ where: { userId: viewer.id } }),
    db.profileView.findMany({ where: { viewedId: viewer.id, createdAt: { gte: since14 } }, select: { createdAt: true } }),
    db.notification.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, body: true, titleKey: true, bodyKey: true, vars: true, href: true, createdAt: true, readAt: true } }),
    suggestions(viewer.id, 3),
    db.userAchievement.findMany({ where: { userId: viewer.id }, select: { code: true } }),
    db.profile.findUnique({
      where: { id: viewer.profileId },
      select: {
        educations: { select: { id: true, school: true, degree: true, fieldOfStudy: true, startDate: true, endDate: true } },
        experiences: { select: { id: true, title: true, companyName: true, isCurrent: true, description: true, startDate: true, endDate: true } },
        projects: { select: { id: true, title: true, summary: true, startDate: true, endDate: true } },
      },
    }),
    viewer.company
      ? Promise.all([
          db.job.count({ where: { companyId: viewer.company.id, status: "OPEN" } }),
          db.application.count({ where: { job: { companyId: viewer.company.id }, status: "APPLIED" } }),
        ])
      : null,
  ]);
  const relations = await relationStates(viewer.id, people.map((p) => p.user.id));

  const byStatus = Object.fromEntries(appCounts.map((c) => [c.status, c._count])) as Record<string, number>;
  const active = APPLICATION_TRACK.slice(0, 5).reduce((s, k) => s + (byStatus[k] ?? 0), 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since14.getTime() + i * 86_400_000);
    return { key: d.toDateString(), label: f.date(d, { month: "short", day: "numeric", timeZone: "UTC" }), value: 0 };
  });
  for (const v of views) {
    const day = days.find((d) => d.key === new Date(v.createdAt).toDateString());
    if (day) day.value++;
  }
  const totalViews = views.length;
  const journey = journeyData ? buildJourney(journeyData, t("profile.present")) : [];
  const earned = new Set(achievements.map((a) => a.code as AchievementCode));

  const stats = [
    { label: t("home.statActive"), value: active, icon: Briefcase, href: "/applications" },
    { label: t("home.statInterviews"), value: (byStatus.INTERVIEW ?? 0) + (byStatus.OFFER ?? 0), icon: CalendarClock, href: "/interviews" },
    { label: t("home.statViews"), value: totalViews, icon: Eye, href: "/profile/views" },
    { label: t("home.statSaved"), value: savedCount, icon: Bookmark, href: "/jobs/saved" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_300px]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <ProfileSummaryCard viewer={viewer} />
          <Card className="p-5">
            <CardHeader title={t("home.achievements")} action={<Link href="/profile/achievements" className="text-xs font-medium text-brand-soft-fg hover:underline">{t("home.all")}</Link>} />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {ACHIEVEMENT_CODES.slice(0, 6).map((code) => (
                <AchievementBadge key={code} code={code} earned={earned.has(code)} size="sm" />
              ))}
            </div>
          </Card>
        </div>
      </aside>

      <section className="min-w-0 space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-fg-muted">{t("home.welcome")}</p>
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">{viewer.name.split(" ")[0]} 👋</h1>
            </div>
            <Link href="/feed" className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
              {t("home.openFeed")} <ArrowRight />
            </Link>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.05}>
              <Link href={s.href} className="surface surface-hover block p-4">
                <s.icon className="size-4 text-brand" />
                <div className="mt-3 font-display text-2xl font-semibold">
                  <AnimatedNumber value={s.value} />
                </div>
                <div className="text-xs text-fg-muted">{s.label}</div>
              </Link>
            </Reveal>
          ))}
        </div>

        {viewer.company && hiring && (
          <Link href="/recruiter" className="surface surface-hover flex items-center gap-4 border-brand/25 bg-gradient-to-r from-brand-soft/60 to-transparent p-4 rtl:bg-gradient-to-l">
            <span className="grid size-11 place-items-center rounded-xl bg-brand text-brand-fg">
              <KanbanSquare className="size-5" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t("home.hiringAt", { company: viewer.company.name })}</div>
              <div className="text-xs text-fg-muted">
                {t("home.hiringSub", { jobs: hiring[0], applicants: hiring[1] })}
              </div>
            </div>
            <ArrowRight className="size-4 text-fg-muted" />
          </Link>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Sparkles className="size-4 text-brand" /> {t("home.matching")}
            </h2>
            <Link href="/jobs/for-you" className="text-sm font-medium text-brand-soft-fg hover:underline">
              {t("common.seeAll")}
            </Link>
          </div>
          {jobs.length ? (
            <div className="space-y-3">
              {jobs.map((j) => (
                <JobCard key={j.id} job={j} signedIn />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles />}
              title={t("home.unlock")}
              description={t("home.unlockBody")}
              action={
                <Link href="/profile/skills" className={buttonClasses({ pill: true })}>
                  {t("jobs.addSkills")}
                </Link>
              }
            />
          )}
        </section>

        <Card className="p-6">
          <CardHeader
            title={t("home.yourApps")}
            description={nextInterview ? undefined : t("home.trackStages")}
            action={
              <Link href="/applications" className="text-sm font-medium text-brand-soft-fg hover:underline">
                {t("common.manage")}
              </Link>
            }
          />
          {nextInterview && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft/60 p-3.5 text-sm">
              <CalendarClock className="size-5 text-brand" />
              <div>
                <span className="font-semibold">{t("home.nextInterview")}</span> {t("home.at", { job: nextInterview.application.job.title, company: nextInterview.application.job.company.name })}
                <div className="text-xs text-fg-muted">
                  <LocalTime date={nextInterview.startsAt} />
                </div>
              </div>
            </div>
          )}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {APPLICATION_TRACK.map((s) => (
              <div key={s} className="rounded-2xl bg-surface-2/70 p-3 text-center">
                <div className="font-display text-xl font-semibold">{byStatus[s] ?? 0}</div>
                <div className="text-[11px] text-fg-muted">{t(`enums.applicationStatus.${s}`)}</div>
              </div>
            ))}
          </div>
        </Card>

        {journey.length > 0 && (
          <Card className="p-6">
            <CardHeader
              title={t("home.journey")}
              action={
                <Link href="/profile/journey" className="text-sm font-medium text-brand-soft-fg hover:underline">
                  {t("home.explore")}
                </Link>
              }
            />
            <div className="mt-5">
              <CareerJourney steps={journey} compact />
            </div>
          </Card>
        )}
      </section>

      <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
        <Card className="p-5">
          <CardHeader title={t("home.visibility")} description={t("home.visibilitySub", { n: totalViews })} />
          <Bars data={days.map((d) => ({ label: d.label, value: d.value }))} label={t("home.viewsChart")} className="mt-4" />
          <Link href="/profile/views" className="mt-3 block text-xs font-medium text-brand-soft-fg hover:underline">
            {t("home.whoViewed")}
          </Link>
        </Card>

        <Card className="p-5">
          <CardHeader
            title={t("home.notifications")}
            action={
              <Link href="/notifications" className="text-xs font-medium text-brand-soft-fg hover:underline">
                {t("common.viewAll")}
              </Link>
            }
          />
          <ul className="mt-3 space-y-1">
            {notifications.length === 0 && <li className="text-sm text-fg-muted">{t("home.caughtUp")}</li>}
            {notifications.map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? "/notifications"} className="flex gap-2.5 rounded-xl p-2 text-sm hover:bg-surface-2">
                  <Bell className={`mt-0.5 size-4 shrink-0 ${n.readAt ? "text-fg-subtle" : "text-brand"}`} />
                  <span className={`flex-1 ${n.readAt ? "text-fg-muted" : "font-medium"}`}>{renderNotification(t, n).title}</span>
                  <span className="text-[11px] text-fg-subtle">{f.shortTimeAgo(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {people.length > 0 && (
          <Card className="p-5">
            <CardHeader title={t("home.grow")} description={t("home.pymk")} />
            <div className="mt-4 space-y-4">
              {people.map((s) => (
                <PersonCard key={s.user.id} person={s.user} relation={relations.get(s.user.id) ?? { state: "none" }} reason={s.reason} compact />
              ))}
            </div>
            <Link href="/network" className={buttonClasses({ variant: "ghost", size: "sm", className: "mt-3 w-full" })}>
              <Users /> {t("home.visitNetwork")}
            </Link>
          </Card>
        )}
      </aside>
    </div>
  );
}
