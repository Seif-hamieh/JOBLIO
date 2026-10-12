import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Award, Briefcase, CodeXml, ExternalLink, FolderGit2, Mail, MapPin, Sparkles } from "lucide-react";
import { db } from "@/server/db";
import { getViewer } from "@/server/session";
import { getI18n } from "@/i18n/server";
import { Logo } from "@/components/brand/logo";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { RichText } from "@/components/feed/rich-text";
import { LevelBars } from "@/components/skills/level-picker";
import { LanguageToggle } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { RESERVED_USERNAMES } from "@/lib/constants";
import { hostname, safeExternalUrl } from "@/lib/utils";

/**
 * A member's Premium Portfolio at /{username}. Published only while the
 * member has an active Premium Portfolio plan and has switched it on.
 */
const loadPortfolio = cache(async (username: string) => {
  if (!/^[a-z0-9][a-z0-9._-]{1,38}$/i.test(username) || RESERVED_USERNAMES.has(username.toLowerCase())) return null;
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      image: true,
      username: true,
      profile: {
        select: {
          headline: true,
          about: true,
          city: true,
          countryCode: true,
          website: true,
          coverUrl: true,
          openToWork: true,
          portfolioEnabled: true,
          portfolioAccent: true,
          skills: { orderBy: { position: "asc" }, take: 18, select: { id: true, level: true, isTop: true, skill: { select: { name: true } } } },
          experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }], select: { id: true, title: true, companyName: true, isCurrent: true, startDate: true, endDate: true, description: true, company: { select: { logoUrl: true, brandColor: true } } } },
          projects: { orderBy: [{ featured: "desc" }, { position: "asc" }], select: { id: true, title: true, summary: true, imageUrl: true, url: true, repoUrl: true, skills: { select: { id: true, name: true } } } },
          certificates: { orderBy: { issueDate: "desc" }, select: { id: true, name: true, issuer: true, issueDate: true, credentialUrl: true } },
          socialLinks: { select: { id: true, platform: true, url: true } },
        },
      },
      subscriptions: { where: { product: "PREMIUM_PORTFOLIO", status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } }, select: { id: true }, take: 1 },
    },
  });
  if (!user?.profile?.portfolioEnabled || !user.subscriptions.length) return null;
  return user;
});

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const u = await loadPortfolio(username);
  if (!u) return {};
  return { title: { absolute: `${u.name} — ${u.profile!.headline ?? "JOBLIO"}` }, description: u.profile!.about?.slice(0, 160) };
}

export default async function PortfolioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [user, viewer, { t, f }] = await Promise.all([loadPortfolio(username), getViewer(), getI18n()]);
  if (!user) notFound();
  const p = user.profile!;
  const location = f.location(p.city, p.countryCode);
  const website = safeExternalUrl(p.website);
  const accent = p.portfolioAccent ?? null;

  return (
    <div className="min-h-dvh" style={accent ? ({ "--brand": accent, "--brand-soft-fg": accent } as React.CSSProperties) : undefined}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-sm font-semibold text-fg-muted" dir="ltr">
          getjoblio.app/{user.username}
        </span>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-5 pb-16">
        {/* Intro */}
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface p-8 sm:p-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={p.coverUrl ? { backgroundImage: `url(${p.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "radial-gradient(circle at 85% 0%, var(--brand), transparent 55%)" }}
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar name={user.name} src={user.image} size="2xl" ring />
            <div className="min-w-0">
              <Reveal>
                <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{user.name}</h1>
              </Reveal>
              {p.headline && <p className="mt-2 text-lg text-fg-muted">{p.headline}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {location}
                  </span>
                )}
                {p.openToWork && <OpenToWorkBadge />}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {viewer && viewer.id !== user.id ? (
                  <Link href={`/messages?to=${user.id}`} className={buttonClasses({ pill: true })}>
                    <Mail /> {t("portfolio.sendMessage")}
                  </Link>
                ) : null}
                <Link href={`/in/${user.username}`} className={buttonClasses({ variant: "outline", pill: true })}>
                  {t("portfolio.viewProfile")}
                </Link>
                {website && (
                  <a href={website} target="_blank" rel="noopener noreferrer nofollow me" className={buttonClasses({ variant: "ghost", pill: true })}>
                    <ExternalLink /> {hostname(website)}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {p.about && (
          <section>
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Sparkles className="size-5 text-brand" /> {t("portfolio.about")}
            </h2>
            <RichText text={p.about} clamp={1200} className="mt-4 max-w-3xl text-[17px] leading-relaxed text-fg-muted" />
          </section>
        )}

        {p.projects.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <FolderGit2 className="size-5 text-brand" /> {t("portfolio.projects")}
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {p.projects.map((pr, i) => {
                const url = safeExternalUrl(pr.url);
                const repo = safeExternalUrl(pr.repoUrl);
                return (
                  <Reveal key={pr.id} delay={i * 0.05}>
                    <article className="surface surface-hover group h-full overflow-hidden">
                      {pr.imageUrl && (
                        <div className="aspect-[16/9] overflow-hidden bg-surface-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={pr.imageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-display text-lg font-semibold">{pr.title}</h3>
                        {pr.summary && <p className="mt-1 text-sm text-fg-muted">{pr.summary}</p>}
                        {pr.skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {pr.skills.map((s) => (
                              <span key={s.id} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-muted">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 flex gap-4 text-sm font-medium">
                          {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand-soft-fg hover:underline">
                              <ExternalLink className="size-4" /> {t("profile.live")}
                            </a>
                          )}
                          {repo && (
                            <a href={repo} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                              <CodeXml className="size-4" /> {t("profile.code")}
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          {p.experiences.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <Briefcase className="size-5 text-brand" /> {t("portfolio.experience")}
              </h2>
              <ol className="mt-5 space-y-6 border-s border-border ps-6">
                {p.experiences.map((e) => (
                  <li key={e.id} className="relative">
                    <span className={`absolute -start-[31px] top-1.5 size-3 rounded-full ring-4 ring-bg ${e.isCurrent ? "bg-mint" : "bg-brand"}`} />
                    <div className="flex items-start gap-3">
                      <CompanyLogo name={e.companyName} src={e.company?.logoUrl} color={e.company?.brandColor} size="sm" />
                      <div>
                        <div className="font-semibold">{e.title}</div>
                        <div className="text-sm text-fg-muted">{e.companyName}</div>
                        <div className="text-xs text-fg-subtle">
                          {f.date(e.startDate)} – {e.isCurrent ? t("profile.present") : f.date(e.endDate)}
                        </div>
                        {e.description && <RichText text={e.description} clamp={220} className="mt-2 text-sm text-fg-muted" />}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="space-y-10">
            {p.skills.length > 0 && (
              <section>
                <h2 className="font-display text-2xl font-semibold">{t("portfolio.skills")}</h2>
                <ul className="mt-5 grid gap-2">
                  {p.skills.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm">
                      <span className={s.isTop ? "font-semibold" : ""}>{s.skill.name}</span>
                      <span className="flex items-center gap-2 text-xs text-fg-muted">
                        {t(`enums.skillLevel.${s.level}`)} <LevelBars level={s.level} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {p.certificates.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                  <Award className="size-5 text-brand" /> {t("portfolio.certificates")}
                </h2>
                <ul className="mt-5 space-y-3">
                  {p.certificates.map((c) => {
                    const link = safeExternalUrl(c.credentialUrl);
                    return (
                      <li key={c.id} className="text-sm">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-fg-muted">
                          {c.issuer}
                          {c.issueDate && ` · ${f.date(c.issueDate)}`}
                        </div>
                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="text-xs font-medium text-brand-soft-fg hover:underline">
                            {t("profile.showCredential")}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {p.socialLinks.length > 0 && (
              <section>
                <h2 className="font-display text-2xl font-semibold">{t("portfolio.contact")}</h2>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {p.socialLinks.map((l) => {
                    const url = safeExternalUrl(l.url);
                    return url ? (
                      <li key={l.id}>
                        <a href={url} target="_blank" rel="noopener noreferrer nofollow me" className={buttonClasses({ variant: "outline", size: "sm", pill: true })}>
                          {t(`enums.social.${l.platform}`)}
                        </a>
                      </li>
                    ) : null;
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 text-xs text-fg-subtle">
          <span>{t("portfolio.poweredBy")}</span>
          <Logo />
        </div>
      </footer>
    </div>
  );
}
