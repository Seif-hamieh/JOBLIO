import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Briefcase, Building2, CalendarDays, Gift, Globe, Heart, MapPin, Settings2, Sparkles, Users } from "lucide-react";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";
import { jobCardSelect } from "@/server/services/jobs";
import { getCandidateFacts, scoreJobs } from "@/server/services/matching";
import { getFeed } from "@/server/services/feed";
import { personCardSelect } from "@/server/services/network";
import { FollowCompanyButton } from "@/components/companies/follow-button";
import { CompanyGallery } from "@/components/companies/gallery";
import { JobCard } from "@/components/jobs/job-card";
import { FeedList } from "@/components/feed/feed-list";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/motion";
import { buttonClasses } from "@/components/ui/button";
import { RichText } from "@/components/feed/rich-text";
import { hostname, safeExternalUrl } from "@/lib/utils";
import { getI18n } from "@/i18n/server";
import { industryName } from "@/i18n/translate";

const clip = (s: string | null | undefined, n = 160) => (s ? (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s).replace(/s+/g, " ") : undefined);

export async function generateMetadata({ params }: PageProps<"/companies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.company.findUnique({ where: { slug }, select: { name: true, tagline: true, about: true } });
  if (!c) notFound(); // real 404 status for crawlers
  const description = clip(c.tagline || c.about);
  return { title: c.name, description, openGraph: { type: "website", siteName: "JOBLIO", title: c.name, description } };
}

export default async function CompanyPage({ params }: PageProps<"/companies/[slug]">) {
  const { slug } = await params;
  const [viewer, { t, f }] = await Promise.all([getViewer(), getI18n()]);
  const company = await db.company.findUnique({
    where: { slug },
    include: {
      industry: { select: { name: true } },
      media: { orderBy: { position: "asc" } },
      _count: { select: { jobs: { where: { status: "OPEN" } }, members: true } },
    },
  });
  if (!company) notFound();

  const premium = !!company.premiumUntil && company.premiumUntil > new Date();
  const accent = premium && company.brandColor ? company.brandColor : null;
  const isMember = viewer?.company?.id === company.id;

  const [jobs, employees, employeeCount, following, feed, facts] = await Promise.all([
    db.job.findMany({
      where: { companyId: company.id, status: "OPEN" },
      select: jobCardSelect,
      orderBy: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
      take: 12,
    }),
    db.user.findMany({
      where: {
        OR: [{ companyMemberships: { some: { companyId: company.id } } }, { profile: { experiences: { some: { companyId: company.id, isCurrent: true } }, visibility: { not: "CONNECTIONS" } } }],
      },
      select: personCardSelect,
      take: 8,
    }),
    db.user.count({ where: { OR: [{ companyMemberships: { some: { companyId: company.id } } }, { profile: { experiences: { some: { companyId: company.id, isCurrent: true } } } }] } }),
    viewer ? db.companyFollower.findUnique({ where: { userId_companyId: { userId: viewer.id, companyId: company.id } } }) : null,
    viewer ? getFeed(viewer.id, { companyId: company.id }) : null,
    viewer ? getCandidateFacts(viewer.id) : null,
  ]);
  const matches = scoreJobs(facts, jobs);
  const website = safeExternalUrl(company.website);
  const location = f.location(company.city, company.countryCode);

  return (
    <div className="space-y-6" style={accent ? ({ "--brand": accent } as React.CSSProperties) : undefined}>
      <section className="surface overflow-hidden">
        <div
          className="relative h-40 overflow-hidden sm:h-56"
          style={{ backgroundImage: `linear-gradient(120deg, ${company.brandColor ?? "var(--brand)"}, var(--aurora))` }}
        >
          {company.coverUrl && (
            // A real <img> (not a CSS background) is found by the browser's preload scanner, so the largest
            // image above the fold starts downloading with the HTML — better LCP.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.coverUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 size-full object-cover" />
          )}
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <CompanyLogo name={company.name} src={company.logoUrl} color={company.brandColor} size="xl" className="relative z-10 -mt-12 ring-4 ring-surface" />
            <div className="flex flex-wrap gap-2">
              {isMember ? (
                <Link href="/company/dashboard" className={buttonClasses({ pill: true })}>
                  <Settings2 /> {t("companies.managePage")}
                </Link>
              ) : (
                <FollowCompanyButton companyId={company.id} following={!!following} signedIn={!!viewer} />
              )}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={buttonClasses({ variant: "outline", pill: true })}>
                  <Globe /> {hostname(website)}
                </a>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{company.name}</h1>
              {company.verified && <BadgeCheck className="size-6 text-brand" aria-label={t("common.verified")} />}
              {premium && <Badge tone="ember">{t("common.premium")}</Badge>}
            </div>
            {company.tagline && <p className="mt-1 text-[17px] text-fg-muted">{company.tagline}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-fg-muted">
              {company.industry && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" /> {industryName(t, company.industry.name)}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {location}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" /> {t(`enums.companySize.${company.size}`)}
              </span>
              {company.foundedYear && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" /> {t("companies.founded", { year: company.foundedYear })}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Heart className="size-4" /> {t("companies.followers", { n: f.compact(company.followerCount) })}
              </span>
            </div>
          </div>
        </div>
        <nav className="scrollbar-none flex gap-1 overflow-x-auto border-t border-border px-4 py-2 text-sm sm:px-7">
          {[
            ["about", t("companies.about")],
            ["life", t("companies.lifeAt", { company: company.name })],
            ["jobs", t("companies.jobsTab", { n: company._count.jobs })],
            ["people", t("companies.people")],
            ["posts", t("companies.posts")],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full px-3 py-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {company.about && (
            <Reveal>
              <Card className="scroll-mt-24 p-6 sm:p-7">
                <h2 id="about" className="font-display text-lg font-semibold">
                  {t("companies.about")}
                </h2>
                <RichText text={company.about} clamp={700} className="mt-3 text-fg-muted" />
              </Card>
            </Reveal>
          )}

          <Reveal>
            <Card className="p-6 sm:p-7">
              <h2 id="life" className="flex scroll-mt-24 items-center gap-2 font-display text-lg font-semibold">
                <Sparkles className="size-[18px] text-brand" /> {t("companies.lifeAt", { company: company.name })}
              </h2>
              {company.cultureText && <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{company.cultureText}</p>}
              {company.values.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {company.values.map((v) => (
                    <span key={v} className="rounded-full border border-brand/25 bg-brand-soft/60 px-3 py-1 text-sm font-medium text-brand-soft-fg">
                      {v}
                    </span>
                  ))}
                </div>
              )}
              {company.media.length > 0 && (
                <div className="mt-5">
                  <CompanyGallery items={company.media} />
                </div>
              )}
              {!company.cultureText && company.media.length === 0 && company.values.length === 0 && <p className="mt-3 text-sm text-fg-muted">{t("companies.noCulture")}</p>}
            </Card>
          </Reveal>

          <section id="jobs" className="scroll-mt-24 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{t("companies.openPositions", { n: company._count.jobs })}</h2>
              {company._count.jobs > jobs.length && (
                <Link href={`/jobs?company=${company.slug}`} className="text-sm font-medium text-brand-soft-fg hover:underline">
                  {t("common.seeAll")}
                </Link>
              )}
            </div>
            {jobs.length ? (
              jobs.map((j) => <JobCard key={j.id} job={{ ...j, match: matches.get(j.id) }} signedIn={!!viewer} />)
            ) : (
              <EmptyState icon={<Briefcase />} title={t("companies.noRoles")} description={t("companies.noRolesBody", { company: company.name })} />
            )}
          </section>

          <section id="posts" className="scroll-mt-24 space-y-3">
            <h2 className="font-display text-lg font-semibold">{t("companies.updates")}</h2>
            {feed && viewer ? (
              <FeedList
                initial={feed.posts}
                nextCursor={feed.nextCursor}
                viewer={{ id: viewer.id, name: viewer.name, image: viewer.image }}
                scope={{ companyId: company.id }}
                emptyTitle={t("companies.noUpdates")}
                emptyDescription={t("companies.noUpdatesBody", { company: company.name })}
              />
            ) : (
              <Card className="p-6 text-center text-sm text-fg-muted">
                <Link href="/login" className="font-semibold text-brand-soft-fg hover:underline">
                  {t("common.signIn")}
                </Link>{" "}
                {t("companies.signInUpdates", { company: company.name })}
              </Card>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {company.benefits.length > 0 && (
            <Card className="p-5">
              <CardHeader title={t("companies.benefits")} />
              <ul className="mt-3 space-y-2">
                {company.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm">
                    <Gift className="size-4 shrink-0 text-ember" /> {b}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <div id="people" className="scroll-mt-24">
              <CardHeader title={t("companies.peopleOn", { n: employeeCount })} description={t("companies.peopleSub")} />
            </div>
            <ul className="mt-3 space-y-3">
              {employees.map((p) => (
                <li key={p.id}>
                  <Link href={`/in/${p.username}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface-2">
                    <Avatar name={p.name} src={p.image} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-fg-muted">{p.profile?.headline}</div>
                    </div>
                  </Link>
                </li>
              ))}
              {employees.length === 0 && <li className="text-sm text-fg-muted">{t("companies.noMembers")}</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
