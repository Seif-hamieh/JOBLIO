import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, ExternalLink, FileText, GraduationCap, Lock, MapPin, MessageSquare } from "lucide-react";
import { requireRecruiter } from "@/server/session";
import { db } from "@/server/db";
import { candidateMatchSelect, jobMatchSelect, toCandidateFacts, toJobFacts } from "@/server/services/matching";
import { canViewProfile } from "@/server/services/profile";
import { recordProfileView } from "@/server/services/profile-page";
import { computeMatch } from "@/lib/matching/engine";
import { buildJourney } from "@/lib/journey";
import { MatchBreakdown } from "@/components/match/match-breakdown";
import { MatchPill } from "@/components/match/match-ring";
import { SkillConstellation } from "@/components/skills/skill-constellation";
import { CareerJourney } from "@/components/profile/career-journey";
import { SaveCandidateButton } from "@/components/recruiter/save-candidate-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge, OpenToWorkBadge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

export const generateMetadata = pageTitle("meta.candidate");

export default async function CandidateProfilePage({ params, searchParams }: PageProps<"/recruiter/candidates/[username]">) {
  const { username } = await params;
  const { job: jobParam } = await searchParams;
  const [viewer, { t, f }] = await Promise.all([requireRecruiter(), getI18n()]);

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      image: true,
      username: true,
      profile: {
        select: {
          ...candidateMatchSelect,
          id: true,
          headline: true,
          about: true,
          openToWork: true,
          visibility: true,
          searchableByRecruiters: true,
          resumeUrl: true,
          skills: { orderBy: { position: "asc" }, select: { id: true, skillId: true, level: true, endorsementCount: true, skill: { select: { name: true, category: true } } } },
          experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }], select: { id: true, title: true, companyName: true, isCurrent: true, description: true, startDate: true, endDate: true } },
          educations: { select: { id: true, school: true, degree: true, fieldOfStudy: true, startDate: true, endDate: true } },
          projects: { select: { id: true, title: true, summary: true, startDate: true, endDate: true } },
        },
      },
      applications: { where: { job: { companyId: viewer.company.id } }, select: { id: true, status: true, matchScore: true, jobId: true, job: { select: { title: true } } } },
    },
  });
  if (!user?.profile) notFound();
  const p = user.profile;

  // Candidates who applied to you are always visible to your team; otherwise
  // they must allow recruiter search and their profile must be visible to you.
  const allowed = user.applications.length > 0 || (p.searchableByRecruiters && (await canViewProfile(user.id, p.visibility, viewer.id)));
  if (!allowed) {
    return <EmptyState className="mt-10" icon={<Lock />} title={t("recruiter.privateProfile")} description={t("recruiter.privateProfileBody")} />;
  }
  await recordProfileView(user.id, { id: viewer.id, name: viewer.name, company: viewer.company });

  const [jobs, saved] = await Promise.all([
    db.job.findMany({ where: { companyId: viewer.company.id, status: "OPEN" }, select: { id: true, title: true, ...jobMatchSelect } }),
    db.savedCandidate.findUnique({ where: { recruiterId_candidateId: { recruiterId: viewer.id, candidateId: user.id } } }),
  ]);
  const facts = toCandidateFacts(p);
  const scored = jobs.map((j) => ({ id: j.id, title: j.title, match: computeMatch(facts, toJobFacts(j), "recruiter") })).sort((a, b) => b.match.score - a.match.score);
  const selected = scored.find((s) => s.id === jobParam) ?? scored[0];
  const journey = buildJourney({ educations: p.educations, experiences: p.experiences, projects: p.projects }, t("profile.present"));

  return (
    <div className="space-y-6">
      <Link href="/recruiter/candidates" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("recruiter.backToSearch")}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={user.name} src={user.image} size="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold">{user.name}</h1>
                  {p.openToWork && <OpenToWorkBadge />}
                </div>
                <p className="text-fg-muted">{p.headline}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
                  {(p.city || p.countryCode) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" /> {f.location(p.city, p.countryCode)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="size-4" /> {f.years(p.yearsExperience)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap className="size-4" /> {p.educationLevel === "NONE" ? "—" : t(`enums.educationLevel.${p.educationLevel}`)}
                  </span>
                  <span>{t(`enums.availability.${p.availability}`)}</span>
                </div>
                <div className="mt-2 text-sm text-fg-muted">
                  {t("recruiter.expects", { salary: f.salary(p.desiredSalaryMin, null, p.salaryCurrency, p.salaryPeriod) ?? t("recruiter.notShared") })}
                  {p.languages.length > 0 && ` · ${p.languages.map((l) => `${f.language(l.languageCode)} (${t(`enums.proficiency.${l.proficiency}`)})`).join("، ")}`}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/messages?to=${user.id}${selected ? `&job=${selected.id}` : ""}`} className={buttonClasses({ pill: true })}>
                <MessageSquare /> {t("recruiter.contact")}
              </Link>
              <SaveCandidateButton candidateId={user.id} saved={!!saved} />
              {p.resumeUrl && (
                <a href={p.resumeUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "outline", pill: true })}>
                  <FileText /> {t("recruiter.profileCv")}
                </a>
              )}
              <Link href={`/in/${user.username}`} className={buttonClasses({ variant: "ghost", pill: true })}>
                <ExternalLink /> {t("recruiter.publicProfile")}
              </Link>
            </div>
          </Card>

          {user.applications.length > 0 && (
            <Card className="p-6">
              <CardHeader title={t("recruiter.appsToCompany")} />
              <ul className="mt-3 divide-y divide-border">
                {user.applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/recruiter/jobs/${a.jobId}/pipeline?a=${a.id}`} className="text-sm font-medium hover:underline">
                      {a.job.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      <MatchPill score={a.matchScore} />
                      <Badge>{t(`enums.applicationStatus.${a.status}`)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {p.about && (
            <Card className="p-6">
              <CardHeader title={t("profile.about")} />
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{p.about}</p>
            </Card>
          )}

          {journey.length > 0 && (
            <Card className="p-6">
              <CardHeader title={t("profile.journey")} />
              <div className="mt-4">
                <CareerJourney steps={journey} compact />
              </div>
            </Card>
          )}

          {p.skills.length > 0 && (
            <Card className="p-6">
              <CardHeader title={t("profile.tabSkills")} description={t("recruiter.nodeSize")} />
              <SkillConstellation name={user.name} skills={p.skills.map((s) => ({ id: s.id, name: s.skill.name, category: s.skill.category, level: s.level, endorsements: s.endorsementCount }))} />
            </Card>
          )}

          <Card className="p-6">
            <CardHeader title={t("profile.experience")} />
            <ul className="mt-4 space-y-4">
              {p.experiences.map((e) => (
                <li key={e.id}>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-sm text-fg-muted">{e.companyName}</div>
                  <div className="text-xs text-fg-subtle">
                    {f.date(e.startDate)} – {e.isCurrent ? t("profile.present") : f.date(e.endDate)}
                  </div>
                </li>
              ))}
              {p.experiences.length === 0 && <li className="text-sm text-fg-muted">{t("recruiter.noExperience")}</li>}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4">
          {scored.length === 0 ? (
            <Card className="p-5 text-sm text-fg-muted">{t("recruiter.publishToSee")}</Card>
          ) : (
            <>
              <Card className="p-5">
                <CardHeader title={t("profile.matchRoles")} />
                <ul className="mt-3 space-y-1">
                  {scored.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/recruiter/candidates/${user.username}?job=${s.id}`}
                        className={`flex items-center justify-between gap-2 rounded-xl p-2 text-sm ${selected?.id === s.id ? "bg-brand-soft/60" : "hover:bg-surface-2"}`}
                      >
                        <span className="truncate">{s.title}</span>
                        <MatchPill score={s.match.score} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
              {selected && (
                <Card className="p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{selected.title}</div>
                  <MatchBreakdown match={selected.match} perspective="recruiter" />
                </Card>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
