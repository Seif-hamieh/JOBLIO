import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  Crown,
  ExternalLink,
  FolderGit2,
  CodeXml,
  GraduationCap,
  Languages,
  Link2,
  Lock,
  MapPin,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";
import { getProfilePage, recordProfileView } from "@/server/services/profile-page";
import { canMessageUser } from "@/server/services/profile";
import { relationStates } from "@/server/services/network";
import { candidateMatchSelect, jobMatchSelect, toCandidateFacts, toJobFacts } from "@/server/services/matching";
import { computeMatch } from "@/lib/matching/engine";
import { buildJourney } from "@/lib/journey";
import { CareerJourney } from "@/components/profile/career-journey";
import { ProfileActions } from "@/components/profile/profile-actions";
import { SkillConstellation } from "@/components/skills/skill-constellation";
import { SkillCards } from "@/components/skills/skill-cards";
import { AchievementBadge } from "@/components/profile/achievement-badge";
import { MatchPill } from "@/components/match/match-ring";
import { Avatar, CompanyLogo } from "@/components/ui/avatar";
import { Badge, OpenToWorkBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/motion";
import { RichText } from "@/components/feed/rich-text";
import type { AchievementCode } from "@/lib/achievements";
import { hostname, safeExternalUrl } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/in/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [u, { t }] = await Promise.all([db.user.findUnique({ where: { username }, select: { name: true, profile: { select: { headline: true, visibility: true } } } }), getI18n()]);
  if (!u) return { title: t("meta.notFound") };
  return { title: u.name, description: u.profile?.visibility === "PUBLIC" ? (u.profile.headline ?? undefined) : undefined };
}

function Section({ id, title, icon: Icon, children, action }: { id: string; title: string; icon: typeof Briefcase; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Reveal as="section">
      <Card className="scroll-mt-24 p-6 sm:p-7">
        <div id={id} className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Icon className="size-[18px] text-brand" /> {title}
          </h2>
          {action}
        </div>
        <div className="mt-5">{children}</div>
      </Card>
    </Reveal>
  );
}

export default async function ProfilePage({ params }: PageProps<"/in/[username]">) {
  const { username } = await params;
  const [viewer, { t, f }] = await Promise.all([getViewer(), getI18n()]);
  const result = await getProfilePage(username, viewer?.id ?? null);
  if (result.status === "not-found") notFound();
  if (result.status === "private") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Avatar name={result.user.name} src={result.user.image} size="xl" className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-semibold">{result.user.name}</h1>
        {result.user.headline && <p className="text-fg-muted">{result.user.headline}</p>}
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm text-fg-muted">
          <Lock className="size-4" /> {result.user.visibility === "CONNECTIONS" ? t("profile.connectionsOnly") : t("profile.signInToView")}
        </p>
      </div>
    );
  }

  const user = result.user;
  const p = user.profile!;
  const self = viewer?.id === user.id;
  await recordProfileView(user.id, viewer ? { id: viewer.id, name: viewer.name, company: viewer.company } : null);

  const [relations, following, connectionCount, endorsed, canMessage, recruiterJobs] = await Promise.all([
    viewer ? relationStates(viewer.id, [user.id]) : null,
    viewer && !self ? db.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } } }) : null,
    db.connection.count({ where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] } }),
    viewer && !self ? db.endorsement.findMany({ where: { endorserId: viewer.id, userSkill: { profileId: p.id } }, select: { userSkillId: true } }) : [],
    viewer && !self ? canMessageUser({ id: viewer.id, isRecruiter: !!viewer.company }, user.id) : false,
    viewer?.company && !self
      ? db.job.findMany({ where: { companyId: viewer.company.id, status: "OPEN" }, select: { id: true, title: true, ...jobMatchSelect }, take: 20 })
      : [],
  ]);
  const relation = relations?.get(user.id) ?? { state: "none" as const };
  const endorsedSet = new Set(endorsed.map((e) => e.userSkillId));

  // Recruiters see how this person matches their open roles (same transparent engine).
  let jobMatches: { id: string; title: string; score: number }[] = [];
  if (recruiterJobs.length) {
    const facts = toCandidateFacts((await db.profile.findUniqueOrThrow({ where: { id: p.id }, select: candidateMatchSelect }))!);
    jobMatches = recruiterJobs
      .map((j) => ({ id: j.id, title: j.title, score: computeMatch(facts, toJobFacts(j), "recruiter").score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  const boosted = !!p.featuredUntil && p.featuredUntil > new Date();
  const verified = user.achievements.some((a) => a.code === "VERIFIED_PROFESSIONAL");
  const journey = buildJourney({ educations: p.educations, experiences: p.experiences, projects: p.projects }, t("profile.present"));
  const location = f.location(p.city, p.countryCode);
  const website = safeExternalUrl(p.website);
  const membership = user.companyMemberships[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        {/* Hero */}
        <section className="surface overflow-hidden">
          <div
            className="relative h-36 bg-gradient-to-br from-brand via-aurora to-mint sm:h-48"
            style={p.coverUrl ? { backgroundImage: `url(${p.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            {!p.coverUrl && <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:18px_18px]" />}
          </div>
          <div className="px-5 pb-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <Avatar name={user.name} src={user.image} size="2xl" ring className="-mt-14 self-start sm:-mt-16 [&>span]:ring-[5px]" />
              <ProfileActions
                self={self}
                signedIn={!!viewer}
                user={{ id: user.id, name: user.name, username: user.username! }}
                relation={relation}
                following={!!following}
                canMessage={canMessage}
                portfolioUrl={p.portfolioEnabled ? `/${user.username}` : null}
              />
            </div>
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{user.name}</h1>
                {verified && <BadgeCheck className="size-6 text-brand" aria-label={t("common.verified")} />}
                {p.pronouns && <span className="text-sm text-fg-subtle">({p.pronouns})</span>}
              </div>
              {p.headline && <p className="mt-1 text-[17px] text-fg-muted">{p.headline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fg-muted">
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {location}
                  </span>
                )}
                {(p.showConnections || self) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" /> {t("common.connections", { n: connectionCount })}
                  </span>
                )}
                {membership && (
                  <Link href={`/companies/${membership.company.slug}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                    <CompanyLogo name={membership.company.name} src={membership.company.logoUrl} color={membership.company.brandColor} size="sm" className="size-5 rounded-md text-[9px]" />
                    {t("profile.teamMemberAt", { title: membership.title ?? t("profile.teamMember"), company: membership.company.name })}
                  </Link>
                )}
                {website && (
                  <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-brand-soft-fg hover:underline">
                    <Link2 className="size-4" /> {hostname(website)}
                  </a>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.openToWork && <OpenToWorkBadge label={p.availability !== "NOT_LOOKING" ? t("profile.openToWorkAvail", { avail: t(`enums.availability.${p.availability}`) }) : t("prefs.openToWork")} />}
                {boosted && (
                  <Badge tone="ember">
                    <Crown /> {t("profile.lookingForOpps")}
                  </Badge>
                )}
                {p.yearsExperience > 0 && <Badge>{t("common.yearsExp", { n: p.yearsExperience })}</Badge>}
              </div>
            </div>
          </div>
          <nav className="scrollbar-none flex gap-1 overflow-x-auto border-t border-border px-4 py-2 text-sm sm:px-7">
            {[
              ["about", t("profile.about")],
              ["journey", t("profile.journey")],
              ["skills", t("profile.tabSkills")],
              ["experience", t("profile.experience")],
              ["projects", t("profile.projects")],
              ["education", t("profile.education")],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="shrink-0 rounded-full px-3 py-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
        </section>

        {p.about && (
          <Section id="about" title={t("profile.about")} icon={Sparkles}>
            <RichText text={p.about} clamp={600} className="text-fg-muted" />
          </Section>
        )}

        {journey.length > 0 && (
          <Section
            id="journey"
            title={t("profile.journey")}
            icon={Target}
            action={
              self ? (
                <Link href="/profile/journey" className="text-sm font-medium text-brand-soft-fg hover:underline">
                  {t("profile.fullView")}
                </Link>
              ) : undefined
            }
          >
            <CareerJourney steps={journey} />
          </Section>
        )}

        {p.skills.length > 0 && (
          <Section
            id="skills"
            title={t("profile.skills", { n: p.skills.length })}
            icon={Sparkles}
            action={
              self ? (
                <Link href="/profile/skills" className="text-sm font-medium text-brand-soft-fg hover:underline">
                  {t("common.manage")}
                </Link>
              ) : undefined
            }
          >
            <div className="mb-6 rounded-2xl border border-border bg-surface-2/40 p-2">
              <SkillConstellation
                name={user.name}
                skills={p.skills.map((s) => ({ id: s.id, name: s.skill.name, category: s.skill.category, level: s.level, endorsements: s.endorsementCount, isTop: s.isTop }))}
              />
            </div>
            <SkillCards
              canEndorse={relation.state === "connected"}
              skills={p.skills.map((s) => ({
                id: s.id,
                name: s.skill.name,
                slug: s.skill.slug,
                level: s.level,
                years: s.years,
                endorsementCount: s.endorsementCount,
                isTop: s.isTop,
                endorsedByViewer: endorsedSet.has(s.id),
              }))}
            />
            {!self && relation.state !== "connected" && viewer && <p className="mt-3 text-xs text-fg-subtle">{t("skills.connectToEndorse", { name: user.name.split(" ")[0]! })}</p>}
          </Section>
        )}

        {p.experiences.length > 0 && (
          <Section id="experience" title={t("profile.experience")} icon={Briefcase}>
            <ol className="relative space-y-6 border-s border-border ps-6">
              {p.experiences.map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -start-[31px] top-1.5 size-3 rounded-full ring-4 ring-surface ${e.isCurrent ? "bg-mint" : "bg-brand"}`} />
                  <div className="flex items-start gap-3">
                    <CompanyLogo name={e.companyName} src={e.company?.logoUrl} color={e.company?.brandColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-sm text-fg-muted">
                        {e.company?.slug ? (
                          <Link href={`/companies/${e.company.slug}`} className="hover:underline">
                            {e.companyName}
                          </Link>
                        ) : (
                          e.companyName
                        )}{" "}
                        · {t(`enums.employmentType.${e.employmentType}`)}
                        {e.workMode ? ` · ${t(`enums.workMode.${e.workMode}`)}` : ""}
                      </div>
                      <div className="mt-0.5 text-xs text-fg-subtle">
                        {f.date(e.startDate)} – {e.isCurrent ? t("profile.present") : f.date(e.endDate)} · {f.duration(e.startDate, e.isCurrent ? null : e.endDate)}
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                      {e.description && <RichText text={e.description} clamp={260} className="mt-2 text-sm text-fg-muted" />}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {p.projects.length > 0 && (
          <Section
            id="projects"
            title={t("profile.projects")}
            icon={FolderGit2}
            action={
              self ? (
                <Link href="/profile/projects" className="text-sm font-medium text-brand-soft-fg hover:underline">
                  {t("common.manage")}
                </Link>
              ) : undefined
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {p.projects.map((pr) => {
                const url = safeExternalUrl(pr.url);
                const repo = safeExternalUrl(pr.repoUrl);
                return (
                  <article key={pr.id} className="surface-hover group overflow-hidden rounded-2xl border border-border bg-surface">
                    {pr.imageUrl && (
                      <div className="aspect-[16/9] overflow-hidden bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pr.imageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{pr.title}</h3>
                        {pr.featured && (
                          <Badge tone="ember" size="xs">
                            {t("common.featured")}
                          </Badge>
                        )}
                      </div>
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
                      <div className="mt-3 flex gap-3 text-xs font-medium">
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand-soft-fg hover:underline">
                            <ExternalLink className="size-3.5" /> {t("profile.live")}
                          </a>
                        )}
                        {repo && (
                          <a href={repo} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                            <CodeXml className="size-3.5" /> {t("profile.code")}
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>
        )}

        {(p.educations.length > 0 || p.certificates.length > 0) && (
          <Section id="education" title={t("profile.educationCerts")} icon={GraduationCap}>
            <div className="space-y-4">
              {p.educations.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-aurora-soft text-aurora-fg">
                    <GraduationCap className="size-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{e.school}</div>
                    <div className="text-sm text-fg-muted">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || t(`enums.educationLevel.${e.level}`)}</div>
                    <div className="text-xs text-fg-subtle">
                      {[e.startDate && f.date(e.startDate, { year: "numeric" }), e.endDate && f.date(e.endDate, { year: "numeric" })].filter(Boolean).join(" – ")}
                      {e.grade ? ` · ${t("profile.grade", { grade: e.grade })}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {p.certificates.map((c) => {
                const link = safeExternalUrl(c.credentialUrl);
                return (
                  <div key={c.id} className="flex gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember-soft text-ember-fg">
                      <Award className="size-5" />
                    </span>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-fg-muted">{c.issuer}</div>
                      <div className="text-xs text-fg-subtle">
                        {c.issueDate && t("profile.issued", { date: f.date(c.issueDate) })}
                        {c.expiryDate && ` · ${t("profile.expires", { date: f.date(c.expiryDate) })}`}
                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="ms-2 font-medium text-brand-soft-fg hover:underline">
                            {t("profile.showCredential")}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      {/* Right rail */}
      <aside className="space-y-4">
        {jobMatches.length > 0 && (
          <Card className="border-brand/25 p-5">
            <CardHeader title={t("profile.matchRoles")} description={t("profile.matchRolesSub")} />
            <ul className="mt-4 space-y-2">
              {jobMatches.map((j) => (
                <li key={j.id}>
                  <Link href={`/recruiter/candidates/${user.username}?job=${j.id}`} className="flex items-center justify-between gap-2 rounded-xl p-2 text-sm hover:bg-surface-2">
                    <span className="truncate">{j.title}</span>
                    <MatchPill score={j.score} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {(p.desiredTitles.length > 0 || p.preferredWorkModes.length > 0) && (
          <Card className="p-5">
            <CardHeader title={t("profile.interests")} />
            <div className="mt-3 space-y-3 text-sm">
              {p.desiredTitles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.desiredTitles.map((title) => (
                    <Badge key={title} tone="brand">
                      {title}
                    </Badge>
                  ))}
                </div>
              )}
              {p.preferredWorkModes.length > 0 && <div className="text-fg-muted">{p.preferredWorkModes.map((m) => t(`enums.workMode.${m}`)).join(" · ")}</div>}
              {p.preferredEmploymentTypes.length > 0 && <div className="text-fg-muted">{p.preferredEmploymentTypes.map((et) => t(`enums.employmentType.${et}`)).join(" · ")}</div>}
              <div className="flex items-center gap-1.5 text-fg-muted">
                <Calendar className="size-4" /> {t(`enums.availability.${p.availability}`)}
              </div>
            </div>
          </Card>
        )}

        {p.languages.length > 0 && (
          <Card className="p-5">
            <CardHeader title={t("profile.languages")} />
            <ul className="mt-3 space-y-2 text-sm">
              {p.languages.map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Languages className="size-4 text-fg-subtle" /> {f.language(l.languageCode)}
                  </span>
                  <span className="text-xs text-fg-muted">{t(`enums.proficiency.${l.proficiency}`)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {user.achievements.length > 0 && (
          <Card className="p-5">
            <CardHeader title={t("profile.achievements")} />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {user.achievements.map((a) => (
                <AchievementBadge key={a.code} code={a.code as AchievementCode} size="sm" />
              ))}
            </div>
          </Card>
        )}

        {(p.socialLinks.length > 0 || p.portfolioItems.length > 0) && (
          <Card className="p-5">
            <CardHeader title={t("profile.links")} />
            <ul className="mt-3 space-y-1.5">
              {p.socialLinks.map((l) => {
                const url = safeExternalUrl(l.url);
                return url ? (
                  <li key={l.id}>
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow me" className="flex items-center justify-between rounded-xl p-2 text-sm hover:bg-surface-2">
                      {t(`enums.social.${l.platform}`)}
                      <span className="truncate ps-2 text-xs text-fg-subtle">{hostname(url)}</span>
                    </a>
                  </li>
                ) : null;
              })}
              {p.portfolioItems.map((it) => {
                const url = safeExternalUrl(it.url);
                return url ? (
                  <li key={it.id}>
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                      {it.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.thumbnailUrl} alt="" className="size-10 rounded-lg object-cover" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{it.title}</span>
                        {it.description && <span className="block truncate text-xs text-fg-muted">{it.description}</span>}
                      </span>
                    </a>
                  </li>
                ) : null;
              })}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}
