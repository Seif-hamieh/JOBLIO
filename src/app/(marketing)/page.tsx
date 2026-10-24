import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
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
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { publicCompanyWhere } from "@/server/services/companies";
import { HeroVisual } from "@/components/landing/hero-visual";
import { MatchDemo } from "@/components/landing/match-demo";
import { CareerJourney, type JourneyStep } from "@/components/profile/career-journey";
import { AnimatedNumber, Reveal } from "@/components/ui/motion";
import { buttonClasses } from "@/components/ui/button";
import { CompanyLogo } from "@/components/ui/avatar";
import { getI18n } from "@/i18n/server";
import { jsonLdScript } from "@/lib/job-posting-ld";
import { organizationJsonLd, websiteJsonLd } from "@/lib/site-ld";
import { APP_URL } from "@/lib/utils";

// Rendered per request (it follows the visitor's language). Data loading
// degrades gracefully so the page still renders without a database.

// Shared by every visitor and cached for 10 minutes, so the busiest page doesn't query the database
// on each visit. Counts and the latest jobs may lag by up to that long.
const landingData = unstable_cache(
  async () => {
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
      db.company.findMany({ where: publicCompanyWhere, orderBy: { followerCount: "desc" }, take: 14, select: { slug: true, name: true, logoUrl: true, brandColor: true } }),
    ]);
    // Hide the stats strip until the platform has enough content
    // to look credible. Skills is reference data (always populated), so we
    // gate on jobs + companies only.
    const MIN_JOBS_FOR_STATS = 5;
    const MIN_COMPANIES_FOR_STATS = 5;
    const showStats = jobs >= MIN_JOBS_FOR_STATS && companies >= MIN_COMPANIES_FOR_STATS;
    return { stats: showStats ? { jobs, companies, professionals, skills } : null, latestJobs, topCompanies };
  },
  ["landing:v1"],
  { revalidate: 600 },
);

async function getLandingData() {
  try {
    return await landingData();
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

// Sections switched off in the premium redesign to keep the page focused. Flip to true to show them
// again — their content, translations and components are all still here.
const SHOW_CAREER_JOURNEY = false;
const SHOW_PRICING_TEASER = false;

/** Shared section heading: eyebrow, title and lead, centred or start-aligned. */
function SectionHeading({ eyebrow, title, sub, center }: { eyebrow?: React.ReactNode; title: string; sub?: string; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <div className="mb-4 text-[13px] font-medium text-brand-soft-fg">{eyebrow}</div>}
      <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.08]">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-fg-muted">{sub}</p>}
    </Reveal>
  );
}

export default async function LandingPage() {
  const [{ stats, latestJobs, topCompanies }, { t, f, locale }] = await Promise.all([getLandingData(), getI18n()]);

  return (
    <>
      {/* Structured data: brand info and the sitelinks search box. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd(APP_URL, locale)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd(APP_URL)) }} />

      {/* ── 1. Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* One soft brand glow at the top — no busy patterns. */}
        <div className="pointer-events-none absolute -top-56 left-1/2 h-[560px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_11%,transparent),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
              <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[13px] font-medium text-fg-muted shadow-soft">
                <Sparkles className="size-3.5 text-brand" /> {t("landing.badge")}
              </span>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "50ms" }}>
              <h1 className="font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-[72px]">
                {t("landing.h1a")}
                <br />
                {t("landing.h1b")}
                <br />
                <span className="text-gradient">{t("landing.h1c")}</span>
              </h1>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "120ms" }}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-fg-muted sm:text-xl sm:leading-relaxed">{t("landing.sub")}</p>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "180ms" }}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register?intent=SEEKER" className={buttonClasses({ size: "lg", pill: true, className: "group" })}>
                  {t("landing.ctaJob")}
                  <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link href="/register?intent=RECRUITER" className={buttonClasses({ size: "lg", variant: "outline", pill: true })}>
                  {t("landing.ctaTalent")}
                </Link>
              </div>
            </div>
            <div className="motion-safe:animate-[rise-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]" style={{ animationDelay: "240ms" }}>
              <form
                action="/jobs"
                className="mt-10 flex max-w-xl items-center gap-1 rounded-2xl border border-border-strong bg-surface p-1.5 shadow-card transition-[border-color,box-shadow] duration-200 focus-within:border-brand/60 focus-within:shadow-float"
              >
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
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
                {[t("landing.trust1"), t("landing.trust2"), t("landing.trust3")].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-fg-subtle" strokeWidth={2.5} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* ── 2. Proof: live numbers + the companies hiring ─────────────── */}
      {(stats || topCompanies.length > 0) && (
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            {stats && (
              <dl className="grid grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-border rtl:md:divide-x-reverse">
                {[
                  { label: t("landing.statJobs"), value: stats.jobs },
                  { label: t("landing.statCompanies"), value: stats.companies },
                  { label: t("landing.statPros"), value: stats.professionals },
                  { label: t("landing.statSkills"), value: stats.skills },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col-reverse items-center text-center">
                    <dt className="mt-2 text-sm text-fg-muted">{label}</dt>
                    <dd className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
                      <AnimatedNumber value={value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {topCompanies.length > 0 && (
              <div className={`mask-fade-x overflow-hidden ${stats ? "mt-12" : ""}`}>
                <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
                  {[...topCompanies, ...topCompanies].map((c, i) => (
                    <Link
                      key={`${c.slug}-${i}`}
                      href={`/companies/${c.slug}`}
                      className="flex items-center gap-2.5 rounded-full border border-border bg-bg px-4 py-2 text-fg-muted transition-colors duration-200 hover:border-border-strong hover:text-fg"
                    >
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

      {/* ── 3. Who it is for + what is included (was two sections) ───── */}
      <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6" id="employers">
        <SectionHeading center title={t("landing.journeysTitle")} sub={t("landing.journeysSub")} />
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: Users,
              title: t("landing.proTitle"),
              body: t("landing.proBody"),
              points: [t("landing.proP1"), t("landing.proP2"), t("landing.proP3"), t("landing.proP4")],
              href: "/register?intent=SEEKER",
              cta: t("landing.proCta"),
            },
            {
              icon: KanbanSquare,
              title: t("landing.recTitle"),
              body: t("landing.recBody"),
              points: [t("landing.recP1"), t("landing.recP2"), t("landing.recP3"), t("landing.recP4")],
              href: "/register?intent=RECRUITER",
              cta: t("landing.recCta"),
            },
            {
              icon: Building2,
              title: t("landing.coTitle"),
              body: t("landing.coBody"),
              points: [t("landing.coP1"), t("landing.coP2"), t("landing.coP3"), t("landing.coP4")],
              href: "/register?intent=RECRUITER",
              cta: t("landing.coCta"),
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="surface surface-hover group flex h-full flex-col p-8">
                <span className="grid size-11 place-items-center rounded-xl border border-border bg-surface-2 text-brand transition-colors duration-200 group-hover:bg-brand-soft">
                  <c.icon className="size-5" />
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold tracking-[-0.02em]">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{c.body}</p>
                <ul className="mt-6 flex-1 space-y-3 border-t border-border pt-6">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-fg-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} /> {p}
                    </li>
                  ))}
                </ul>
                <Link href={c.href} className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-fg transition-[gap,color] duration-200 hover:gap-2.5 hover:text-brand">
                  {c.cta} <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Included for everyone (formerly the "Everything you need" section) */}
        <Reveal className="mt-20">
          <h3 className="text-center font-display text-lg font-semibold tracking-[-0.02em] text-fg-muted">{t("landing.builtTitle")}</h3>
        </Reveal>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BadgeCheck, title: t("landing.f1t"), body: t("landing.f1b") },
            { icon: MessageSquare, title: t("landing.f2t"), body: t("landing.f2b") },
            { icon: CalendarCheck, title: t("landing.f3t"), body: t("landing.f3b") },
            { icon: BarChart3, title: t("landing.f4t"), body: t("landing.f4b") },
          ].map((item) => (
            <div key={item.title} className="bg-surface p-6 transition-colors duration-200 hover:bg-surface-2">
              <item.icon className="size-5 text-brand" />
              <h4 className="mt-4 font-semibold tracking-[-0.01em]">{item.title}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Transparent matching ───────────────────────────────────── */}
      <section id="how-matching-works" className="relative border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
          <div className="grid items-start gap-14 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <SectionHeading
                eyebrow={
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-4" /> {t("landing.matchBadge")}
                  </span>
                }
                title={t("landing.matchTitle")}
                sub={t("landing.matchBody")}
              />
              <Reveal>
                <dl className="mt-10 grid grid-cols-2 gap-3">
                  {[
                    ["35", t("landing.w1")],
                    ["20", t("landing.w2")],
                    ["12", t("landing.w3")],
                    ["33", t("landing.w4")],
                  ].map(([n, label]) => (
                    <div key={label} className="flex flex-col-reverse rounded-xl border border-border bg-bg p-4">
                      <dt className="mt-1 text-[13px] text-fg-muted">{label}</dt>
                      <dd className="font-display text-2xl font-semibold tracking-[-0.03em]">{n}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-fg-subtle">{t("landing.tryIt")}</p>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <MatchDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Career journey — hidden in the redesign (SHOW_CAREER_JOURNEY). */}
      {SHOW_CAREER_JOURNEY && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHeading title={t("landing.journeyTitle")} sub={t("landing.journeySub")} />
          <div className="mt-12">
            <CareerJourney steps={locale === "ar" ? DEMO_JOURNEY_AR : DEMO_JOURNEY_EN} compact />
          </div>
        </section>
      )}

      {/* ── 5. Latest opportunities ───────────────────────────────────── */}
      {latestJobs.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading title={t("landing.latestTitle")} sub={t("landing.latestSub")} />
            <Link href="/jobs" className={buttonClasses({ variant: "outline", pill: true, className: "group shrink-0" })}>
              {t("landing.browseAll")} <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {latestJobs.map((j, i) => (
              <Reveal key={j.id} delay={i * 0.05}>
                <Link href={`/jobs/${j.id}`} className="surface surface-hover group flex h-full flex-col p-6">
                  <div className="flex items-start gap-3.5">
                    <CompanyLogo name={j.company.name} src={j.company.logoUrl} color={j.company.brandColor} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold tracking-[-0.01em] transition-colors duration-200 group-hover:text-brand">{j.title}</div>
                      <div className="truncate text-sm text-fg-muted">{j.company.name}</div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-fg-muted">
                    <span>{t(`enums.workMode.${j.workMode}`)}</span>
                    <span className="text-border-strong">·</span>
                    <span>{t(`enums.employmentType.${j.employmentType}`)}</span>
                    {(j.city || j.countryCode) && (
                      <>
                        <span className="text-border-strong">·</span>
                        <span>{f.location(j.city, j.countryCode)}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-5 flex flex-1 items-end">
                    <div className="flex w-full items-center justify-between border-t border-border pt-4 text-sm">
                      <span className="font-medium">{f.salary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod) ?? t("landing.salaryUndisclosed")}</span>
                      <span className="truncate ps-3 text-xs text-fg-subtle">{j.skills.map((s) => s.skill.name).join(" · ")}</span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Pricing teaser — hidden in the redesign while payments are paused (SHOW_PRICING_TEASER). */}
      {SHOW_PRICING_TEASER && (
        <section className="border-t border-border bg-surface-2/50">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <Reveal>
              <h2 className="font-display text-3xl font-semibold sm:text-[40px] sm:leading-[1.1]">{t("landing.pricingTitle")}</h2>
              <p className="mt-4 text-lg text-fg-muted">{t("landing.pricingBody")}</p>
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
                <div className="relative text-sm font-semibold text-ember-fg">{t("landing.boostTitle")}</div>
                <div className="relative mt-2 font-display text-4xl font-semibold">{t("premium.fromPrice", { price: "$2.00" })}</div>
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
      )}

      {/* ── 6. Final call to action ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-28 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-20 text-center shadow-card sm:px-12">
            <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_14%,transparent),transparent)]" />
            <h2 className="relative font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
              {t("landing.finalA")} <span className="text-gradient">{t("landing.finalB")}</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-lg leading-relaxed text-fg-muted">{t("landing.finalSub")}</p>
            <div className="relative mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className={buttonClasses({ size: "lg", pill: true, className: "group" })}>
                {t("landing.finalCta")} <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/jobs" className={buttonClasses({ size: "lg", pill: true, variant: "outline" })}>
                {t("landing.exploreFirst")}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
