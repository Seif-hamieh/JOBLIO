import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Check, Circle, ExternalLink } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { listIndustries } from "@/server/services/companies";
import { BasicsForm, PreferencesForm } from "@/components/profile/editor/basics";
import { CertificateManager, EducationManager, ExperienceManager, LanguagesForm, LinksForm } from "@/components/profile/editor/entries";
import { ResumeManager } from "@/components/profile/editor/resume";
import { Card, PageHeader } from "@/components/ui/misc";
import { MatchRing } from "@/components/match/match-ring";
import { buttonClasses } from "@/components/ui/button";
import { profileCompleteness } from "@/lib/profile-completeness";

export const generateMetadata = pageTitle("profile.editProfile");

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="scroll-mt-24 p-6 sm:p-7">
      <div id={id} className="scroll-mt-28">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default async function EditProfilePage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const [p, industries] = await Promise.all([
    db.profile.findUniqueOrThrow({
      where: { id: viewer.profileId },
      include: {
        experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] },
        educations: { orderBy: { startDate: "desc" } },
        certificates: { orderBy: { issueDate: "desc" } },
        languages: true,
        socialLinks: true,
        preferredIndustries: { select: { id: true } },
        _count: { select: { skills: true, projects: true } },
      },
    }),
    listIndustries(),
  ]);
  const { score, items } = profileCompleteness({
    hasPhoto: !!viewer.image,
    headline: p.headline,
    about: p.about,
    city: p.city,
    skillCount: p._count.skills,
    experienceCount: p.experiences.length,
    educationCount: p.educations.length,
    projectCount: p._count.projects,
    languageCount: p.languages.length,
    desiredTitles: p.desiredTitles,
    preferredWorkModes: p.preferredWorkModes,
    socialLinkCount: p.socialLinks.length,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <PageHeader
          title={t("profileEdit.title")}
          description={t("profileEdit.sub")}
          actions={
            <Link href={`/in/${viewer.username}`} className={buttonClasses({ variant: "outline", pill: true })}>
              <ExternalLink /> {t("profileEdit.viewProfile")}
            </Link>
          }
        />
        <Section id="basics" title={t("profileEdit.basics")}>
          <BasicsForm
            image={viewer.image}
            cover={p.coverUrl}
            initial={{
              name: viewer.name,
              headline: p.headline ?? "",
              about: p.about ?? "",
              pronouns: p.pronouns ?? "",
              city: p.city ?? "",
              countryCode: p.countryCode ?? "",
              website: p.website ?? "",
            }}
          />
        </Section>
        <Section id="preferences" title={t("profileEdit.preferences")} description={t("profileEdit.preferencesSub")}>
          <PreferencesForm
            industries={industries}
            initial={{
              openToWork: p.openToWork,
              availability: p.availability === "NOT_LOOKING" ? "ONE_MONTH" : p.availability,
              desiredTitles: p.desiredTitles,
              preferredWorkModes: p.preferredWorkModes,
              preferredEmploymentTypes: p.preferredEmploymentTypes,
              preferredCities: p.preferredCities.map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase())),
              openToRelocate: p.openToRelocate,
              desiredSalaryMin: p.desiredSalaryMin,
              salaryCurrency: p.salaryCurrency,
              salaryPeriod: p.salaryPeriod,
              industryIds: p.preferredIndustries.map((i) => i.id),
            }}
          />
        </Section>
        <Section id="cv" title={t("profileEdit.cv")} description={t("profileEdit.cvSub")}>
          <ResumeManager resume={p.resumeUrl ? { url: p.resumeUrl, name: p.resumeName ?? "CV", updatedAt: (p.resumeUpdatedAt ?? p.updatedAt).toISOString() } : null} />
        </Section>
        <Section id="experience" title={t("profile.experience")} description={t("profileEdit.experienceSub")}>
          <ExperienceManager items={p.experiences} />
        </Section>
        <Section id="education" title={t("profile.education")}>
          <EducationManager items={p.educations} />
        </Section>
        <Section id="certifications" title={t("profileEdit.certifications")}>
          <CertificateManager items={p.certificates} />
        </Section>
        <Section id="languages" title={t("profile.languages")}>
          <LanguagesForm initial={p.languages.map((l) => ({ languageCode: l.languageCode, proficiency: l.proficiency }))} />
        </Section>
        <Section id="links" title={t("profileEdit.links")}>
          <LinksForm initial={p.socialLinks.map((l) => ({ platform: l.platform, url: l.url }))} />
        </Section>
      </div>
      <aside>
        <Card className="sticky top-24 p-5">
          <div className="flex items-center gap-4">
            <MatchRing score={score} size={64} stroke={6} />
            <div>
              <div className="font-display font-semibold">{t("profileEdit.strength")}</div>
              <div className="text-xs text-fg-muted">{t("profileEdit.strengthSub")}</div>
            </div>
          </div>
          <ul className="mt-5 space-y-1.5">
            {items.map((i) => (
              <li key={i.key}>
                <Link href={i.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  {i.done ? <Check className="size-4 text-mint" strokeWidth={3} /> : <Circle className="size-4 text-fg-subtle" />}
                  <span className={i.done ? "text-fg-muted line-through decoration-fg-subtle/50" : ""}>{t(`completeness.${i.key}`)}</span>
                  <span className="ms-auto text-[11px] text-fg-subtle">+{i.weight}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
