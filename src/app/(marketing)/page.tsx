import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  Check,
  KanbanSquare,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/server/db";
import { HeroVisual } from "@/components/landing/hero-visual";
import { MatchDemo } from "@/components/landing/match-demo";
import { CareerJourney, type JourneyStep } from "@/components/profile/career-journey";
import { AnimatedNumber, Reveal } from "@/components/ui/motion";
import { buttonClasses } from "@/components/ui/button";
import { CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/i18n/server";

// Rendered per request (it follows the visitor's language). Data loading
// degrades gracefully so the page still renders without a database.

async function getLandingData() {
  try {
    const [jobs, companies, professionals, skills, latestJobs, topCompanies] = await Promise.all([
      db.job.count({ where: { status: "OPEN" } }),
      db.company.count(),
      db.profile.count(),
      db.skill.count(),
      db.job.findMany({
        where: { status: "OPEN" },
        orderBy: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          workMode: true,
          employmentType: true,
          city: true,
          countryCode: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
          company: { select: { name: true, logoUrl: true, brandColor: true } },
          skills: { take: 3, select: { skill: { select: { name: true } } } },
        },
      }),
      db.company.findMany({ orderBy: { followerCount: "desc" }, take: 14, select: { slug: true, name: true, logoUrl: true, brandColor: true } }),
    ]);
    // Hide the stats strip until the platform has enough content
    // to look credible. Skills is reference data (always populated), so we
    // gate on jobs + companies only.
    const MIN_JOBS_FOR_STATS = 5;
    const MIN_COMPANIES_FOR_STATS = 5;
    const showStats = jobs >= MIN_JOBS_FOR_STATS && companies >= MIN_COMPANIES_FOR_STATS;
    return { stats: showStats ? { jobs, companies, professionals, skills } : null, latestJobs, topCompanies };
  } catch {
    return { stats: null, latestJobs: [], topCompanies: [] };
  }
}

const DEMO_JOURNEY_EN: JourneyStep[] = [
  { id: "1", kind: "education", title: "BSc Computer Science", org: "University of Lisbon", period: "2016 – 2020", at: 1, skills: ["Algorithms", "Databases"] },
  { id: "2", kind: "experience", title: "Junior Frontend Developer", org: "Pixel & Co", period: "2020 – 2022", at: 2, skills: ["React", "CSS"] },
  { id: "3", kind: "project", title: "Open-source design system", org: "GitHub · 2.1k stars", period: "2021", at: 3, skills: ["TypeScript", "Storybook"] },
  { id: "4", kind: "experience", title: "Frontend Engineer", org: "Northwind", period: "2022 – 2024", at: 4, skills: ["Next.js", "GraphQL"] },
  { id: "5", kind: "current", title: "Senior Frontend Engineer", org: "Aurora Labs", period: "2024 – Present", at: 5, skills: ["Architecture", "Mentoring"] },
];

const DEMO_JOURNEY_AR: JourneyStep[] = [
  { id: "1", kind: "education", title: "بكالوريوس علوم الحاسوب", org: "جامعة لشبونة", period: "2016 – 2020", at: 1, skills: ["Algorithms", "Databases"] },
  { id: "2", kind: "experience", title: "مطوّر واجهات أمامية مبتدئ", org: "Pixel & Co", period: "2020 – 2022", at: 2, skills: ["React", "CSS"] },
  { id: "3", kind: "project", title: "نظام تصميم مفتوح المصدر", org: "GitHub · 2.1k ⭐", period: "2021", at: 3, skills: ["TypeScript", "Storybook"] },
  { id: "4", kind: "experience", title: "مهندس واجهات أمامية", org: "Northwind", period: "2022 – 2024", at: 4, skills: ["Next.js", "GraphQL"] },
  { id: "5", kind: "current", title: "مهندس واجهات أمامية أول", org: "Aurora Labs", period: "2024 – الآن", at: 5, skills: ["Architecture", "Mentoring"] },
];

export default async function LandingPage() {
  const [{ stats, latestJobs, topCompanies }, { t, f, locale }] = await Promise.all([getLandingData(), getI18n()]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_14%,transparent),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-16">
          <div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
              <Badge tone="brand" size="md" className="mb-6">
                <Sparkles /> {t("landing.badge")}
              </Badge>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "50ms" }}>
              <h1 className="font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[68px]">
                {t("landing.h1a")}
                <br />
                {t("landing.h1b")}
                <br />
                <span className="text-gradient">{t("landing.h1c")}</span>
              </h1>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "120ms" }}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
                {t("landing.sub")}
              </p>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "180ms" }}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register?intent=SEEKER" className={buttonClasses({ size: "lg", pill: true, className: "group" })}>
                  {t("landing.ctaJob")}
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/register?intent=RECRUITER" className={buttonClasses({ size: "lg", variant: "outline", pill: true })}>
                  {t("landing.ctaTalent")}
                </Link>
              </div>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "240ms" }}>
              <form action="/jobs" className="mt-8 flex max-w-xl items-center gap-1 rounded-2xl border border-border bg-surface p-1.5 shadow-card">
                <label className="flex flex-1 items-center gap-2 px-3">
                  <Search className="size-4 shrink-0 text-fg-subtle" />
                  <input name="q" placeholder={t("landing.searchWhat")} className="h-10 w-full bg-transparent text-sm outline-none" aria-label={t("landing.searchWhat")} />
                </label>
                <label className="hidden flex-1 items-center gap-2 border-s border-border px-3 sm:flex">
                  <MapPin className="size-4 shrink-0 text-fg-subtle" />
                  <input name="location" placeholder={t("landing.searchWhere")} className="h-10 w-full bg-transparent text-sm outline-none" aria-label={t("jobs.location")} />
                </label>
                <button className={buttonClasses({ size: "md", variant: "secondary" })}>{t("common.search")}</button>
              </form>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "300ms" }}>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
                {[t("landing.trust1"), t("landing.trust2"), t("landing.trust3")].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-mint" strokeWidth={2.5} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* ── Live stats ───────────────────────────────────────────────── */}
      {stats && (
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
            {[
              { label: t("landing.statJobs"), value: stats.jobs, icon: Briefcase },
              { label: t("landing.statCompanies"), value: stats.companies, icon: Building2 },
              { label: t("landing.statPros"), value: stats.professionals, icon: Users },
              { label: t("landing.statSkills"), value: stats.skills, icon: Sparkles },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center text-center">
                <Icon className="mb-2 size-5 text-brand" />
                <div className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  <AnimatedNumber value={value} />
                </div>
                <div className="mt-1 text-sm text-fg-muted">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Three journeys ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6" id="employers">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-[42px] sm:leading-[1.1]">{t("landing.journeysTitle")}</h2>
          <p className="mt-4 text-lg text-fg-muted">{t("landing.journeysSub")}</p>
        </Reveal>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: Users,
              tone: "bg-brand-soft text-brand-soft-fg",
              title: t("landing.proTitle"),
              body: t("landing.proBody"),
              points: [t("landing.proP1"), t("landing.proP2"), t("landing.proP3"), t("landing.proP4")],
              href: "/register?intent=SEEKER",
              cta: t("landing.proCta"),
            },
            {
              icon: KanbanSquare,
              tone: "bg-mint-soft text-mint-fg",
              title: t("landing.recTitle"),
              body: t("landing.recBody"),
              points: [t("landing.recP1"), t("landing.recP2"), t("landing.recP3"), t("landing.recP4")],
              href: "/register?intent=RECRUITER",
              cta: t("landing.recCta"),
            },
            {
              icon: Building2,
              tone: "bg-aurora-soft text-aurora-fg",
              title: t("landing.coTitle"),
              body: t("landing.coBody"),
              points: [t("landing.coP1"), t("landing.coP2"), t("landing.coP3"), t("landing.coP4")],
              href: "/register?intent=RECRUITER",
              cta: t("landing.coCta"),
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="surface surface-hover flex h-full flex-col p-7">
                <span className={`grid size-12 place-items-center rounded-2xl ${c.tone}`}>
                  <c.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{c.title}</h3>
                <p className="mt-2 text-[15px] text-fg-muted">{c.body}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-mint" strokeWidth={2.5} /> {p}
                    </li>
                  ))}
                </ul>
                <Link href={c.href} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-soft-fg hover:gap-2.5 [transition:gap_0.2s]">
                  {c.cta} <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Transparent matching ─────────────────────────────────────── */}
      <section id="how-matching-works" className="relative border-y border-border bg-surface-2/50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <Badge tone="mint" size="md">
                <ShieldCheck /> {t("landing.matchBadge")}
              </Badge>
              <h2 className="mt-5 font-display text-3xl font-semibold sm:text-[42px] sm:leading-[1.1]">{t("landing.matchTitle")}</h2>
              <p className="mt-4 text-lg text-fg-muted">
                {t("landing.matchBody")}
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-4">
                {[
                  ["35", t("landing.w1")],
                  ["20", t("landing.w2")],
                  ["12", t("landing.w3")],
                  ["33", t("landing.w4")],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                    <dt className="font-display text-2xl font-semibold">{n}</dt>
                    <dd className="mt-1 text-[13px] text-fg-muted">{label}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-fg-subtle">{t("landing.tryIt")}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <MatchDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Career journey ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold sm:text-[42px] sm:leading-[1.1]">{t("landing.journeyTitle")}</h2>
          <p className="mt-4 text-lg text-fg-muted">{t("landing.journeySub")}</p>
        </Reveal>
        <div className="mt-12">
          <CareerJourney steps={locale === "ar" ? DEMO_JOURNEY_AR : DEMO_JOURNEY_EN} compact />
        </div>
      </section>

      {/* ── Latest opportunities ─────────────────────────────────────── */}
      {latestJobs.length > 0 && (
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <Reveal>
                <h2 className="font-display text-3xl font-semibold sm:text-[40px]">{t("landing.latestTitle")}</h2>
                <p className="mt-3 text-lg text-fg-muted">{t("landing.latestSub")}</p>
              </Reveal>
              <Link href="/jobs" className={buttonClasses({ variant: "outline", pill: true })}>
                {t("landing.browseAll")} <ArrowRight />
              </Link>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {latestJobs.map((j, i) => (
                <Reveal key={j.id} delay={i * 0.05}>
                  <Link href={`/jobs/${j.id}`} className="surface surface-hover block p-5">
                    <div className="flex items-start gap-3">
                      <CompanyLogo name={j.company.name} src={j.company.logoUrl} color={j.company.brandColor} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{j.title}</div>
                        <div className="truncate text-sm text-fg-muted">{j.company.name}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge>{t(`enums.workMode.${j.workMode}`)}</Badge>
                      <Badge>{t(`enums.employmentType.${j.employmentType}`)}</Badge>
                      {(j.city || j.countryCode) && <Badge>{f.location(j.city, j.countryCode)}</Badge>}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="font-medium">{f.salary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod) ?? t("landing.salaryUndisclosed")}</span>
                      <span className="truncate ps-3 text-xs text-fg-subtle">{j.skills.map((s) => s.skill.name).join(" · ")}</span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
            {topCompanies.length > 0 && (
              <div className="mask-fade-x mt-16 overflow-hidden">
                <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
                  {[...topCompanies, ...topCompanies].map((c, i) => (
                    <Link key={`${c.slug}-${i}`} href={`/companies/${c.slug}`} className="flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 transition hover:border-border-strong">
                      <CompanyLogo name={c.name} src={c.logoUrl} color={c.brandColor} size="sm" />
                      <span className="text-sm font-medium">{c.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Everything you need ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-[42px] sm:leading-[1.1]">{t("landing.builtTitle")}</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BadgeCheck, title: t("landing.f1t"), body: t("landing.f1b") },
            { icon: MessageSquare, title: t("landing.f2t"), body: t("landing.f2b") },
            { icon: CalendarCheck, title: t("landing.f3t"), body: t("landing.f3b") },
            { icon: BarChart3, title: t("landing.f4t"), body: t("landing.f4b") },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="surface h-full p-6">
                <f.icon className="size-5 text-brand" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface-2/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-[40px] sm:leading-[1.1]">{t("landing.pricingTitle")}</h2>
            <p className="mt-4 text-lg text-fg-muted">
              {t("landing.pricingBody")}
            </p>
            <Link href="/premium" className={buttonClasses({ variant: "outline", pill: true, className: "mt-8" })}>
              {t("landing.seePlans")} <ArrowRight />
            </Link>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal className="surface p-6">
              <div className="text-sm font-semibold text-fg-muted">{t("landing.freeForever")}</div>
              <div className="mt-2 font-display text-4xl font-semibold">$0</div>
              <ul className="mt-5 space-y-2 text-sm">
                {[t("landing.free1"), t("landing.free2"), t("landing.free3"), t("landing.free4")].map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-mint" strokeWidth={2.5} />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="surface relative overflow-hidden p-6 ring-1 ring-ember/40">
              <div className="pointer-events-none absolute -end-12 -top-12 size-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--ember)_30%,transparent),transparent_70%)]" />
              <div className="relative text-sm font-semibold text-ember-fg">{t("landing.boostTitle")}</div>
              <div className="relative mt-2 font-display text-4xl font-semibold">
                {t("premium.fromPrice", { price: "$2.00" })}
              </div>
              <div className="relative text-base font-normal text-fg-muted">{t("landing.boostPrice")}</div>
              <ul className="relative mt-5 space-y-2 text-sm">
                {[t("landing.boost1"), t("landing.boost2"), t("landing.boost3")].map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-ember" strokeWidth={2.5} />
                    {p}
                  </li>
                ))}
              </ul>
              <p className="relative mt-4 text-xs text-fg-subtle">{t("landing.boostNote")}</p>
              <Link href="/premium" className="relative mt-3 inline-flex items-center gap-1 text-sm font-medium text-ember-fg hover:underline">
                {t("landing.boostCta")} →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
              {t("landing.finalA")} <span className="text-gradient">{t("landing.finalB")}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-fg-muted">{t("landing.finalSub")}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className={buttonClasses({ size: "lg", pill: true })}>
                {t("landing.finalCta")} <ArrowRight />
              </Link>
              <Link href="/jobs" className={buttonClasses({ size: "lg", pill: true, variant: "ghost" })}>
                {t("landing.exploreFirst")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
