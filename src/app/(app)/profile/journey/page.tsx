import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Briefcase, FolderGit2, GraduationCap, Plus } from "lucide-react";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { CareerJourney } from "@/components/profile/career-journey";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { buildJourney } from "@/lib/journey";

export const generateMetadata = pageTitle("profile.journey");

export default async function JourneyPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const p = await db.profile.findUniqueOrThrow({
    where: { id: viewer.profileId },
    select: {
      yearsExperience: true,
      educations: { select: { id: true, school: true, degree: true, fieldOfStudy: true, startDate: true, endDate: true, description: true } },
      experiences: { select: { id: true, title: true, companyName: true, isCurrent: true, description: true, startDate: true, endDate: true } },
      projects: { select: { id: true, title: true, summary: true, startDate: true, endDate: true, skills: { select: { name: true } } } },
    },
  });
  const steps = buildJourney(p, t("profile.present"));
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("profile.journey")}
        description={t("profileEdit.journeySub")}
        actions={
          <Link href="/profile/edit#experience" className={buttonClasses({ variant: "outline", pill: true })}>
            <Plus /> {t("profileEdit.addStep")}
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: GraduationCap, label: t("profile.education"), n: p.educations.length },
          { icon: Briefcase, label: t("profileEdit.roles"), n: p.experiences.length, extra: f.years(p.yearsExperience) },
          { icon: FolderGit2, label: t("profile.projects"), n: p.projects.length },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <s.icon className="size-4 text-brand" />
            <div className="mt-2 font-display text-2xl font-semibold">{s.n}</div>
            <div className="text-xs text-fg-muted">
              {s.label}
              {s.extra ? ` · ${s.extra}` : ""}
            </div>
          </Card>
        ))}
      </div>
      {steps.length ? (
        <Card className="p-6">
          <CareerJourney steps={steps} />
        </Card>
      ) : (
        <EmptyState icon={<Briefcase />} title={t("profileEdit.journeyEmpty")} description={t("profileEdit.journeyEmptyBody")} />
      )}
    </div>
  );
}
