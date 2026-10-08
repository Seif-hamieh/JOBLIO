import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Briefcase, GraduationCap, Layers, MapPin, Settings2, Sparkles, Wallet } from "lucide-react";
import { requireViewer } from "@/server/session";
import { jobsForYou } from "@/server/services/jobs";
import { getCandidateFacts, hasMatchingSignals } from "@/server/services/matching";
import { JobCard } from "@/components/jobs/job-card";
import { JobsTabs } from "@/components/jobs/jobs-tabs";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { MATCH_WEIGHTS, matchTier } from "@/lib/matching/engine";

export const generateMetadata = pageTitle("jobs.forYouTitle");

const TIERS = [
  { key: "excellent", title: "jobs.tierExcellent", hint: "jobs.tierExcellentHint" },
  { key: "strong", title: "jobs.tierStrong", hint: "jobs.tierStrongHint" },
  { key: "fair", title: "jobs.tierFair", hint: "jobs.tierFairHint" },
  { key: "low", title: "jobs.tierLow", hint: "jobs.tierLowHint" },
] as const;

export default async function JobsForYouPage() {
  const [viewer, { t, f }] = await Promise.all([requireViewer(), getI18n()]);
  const facts = await getCandidateFacts(viewer.id);
  const jobs = hasMatchingSignals(facts) ? await jobsForYou(viewer.id, { limit: 60 }) : [];

  const signals = facts
    ? [
        { icon: Sparkles, label: t("jobs.sigSkills"), value: facts.skills.length ? t("jobs.sigSkillsVal", { n: facts.skills.length }) : t("jobs.sigNone"), weight: MATCH_WEIGHTS.skills },
        { icon: Briefcase, label: t("jobs.experience"), value: f.years(facts.yearsExperience), weight: MATCH_WEIGHTS.experience },
        {
          icon: MapPin,
          label: t("jobs.location"),
          value: [f.location(facts.city, facts.countryCode) || t("jobs.sigNotSet"), facts.preferredWorkModes.map((m) => t(`enums.workMode.${m}`)).join(" / ")].filter(Boolean).join(" · "),
          weight: MATCH_WEIGHTS.location,
        },
        { icon: Layers, label: t("jobs.sigTypes"), value: f.list(facts.preferredEmploymentTypes.map((et) => t(`enums.employmentType.${et}`))) || t("jobs.sigAny"), weight: MATCH_WEIGHTS.employmentType },
        {
          icon: Wallet,
          label: t("jobs.salary"),
          value: facts.desiredSalaryMin ? `${f.salary(facts.desiredSalaryMin, null, facts.salaryCurrency, facts.salaryPeriod)}+` : t("jobs.sigNotSet"),
          weight: MATCH_WEIGHTS.salary,
        },
        { icon: GraduationCap, label: t("jobs.education"), value: facts.educationLevel === "NONE" ? t("jobs.sigNotSet") : t(`enums.educationLevel.${facts.educationLevel}`), weight: MATCH_WEIGHTS.education },
      ]
    : [];

  return (
    <div className="space-y-6">
      <JobsTabs />
      <PageHeader
        eyebrow={t("jobs.forYouEyebrow")}
        title={t("jobs.forYouTitle")}
        description={t("jobs.forYouSub")}
        actions={
          <Link href="/profile/edit#preferences" className={buttonClasses({ variant: "outline", pill: true })}>
            <Settings2 /> {t("jobs.tune")}
          </Link>
        }
      />

      {signals.length > 0 && (
        <Reveal>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {signals.map((s) => (
              <div key={s.label} className="surface p-4">
                <div className="flex items-center justify-between">
                  <s.icon className="size-4 text-brand" />
                  <span className="text-[11px] font-medium text-fg-subtle">{t("common.ptsN", { n: s.weight })}</span>
                </div>
                <div className="mt-2 text-xs text-fg-subtle">{s.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-medium">{s.value}</div>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {!hasMatchingSignals(facts) ? (
        <EmptyState
          icon={<Sparkles />}
          title={t("jobs.noSignalsTitle")}
          description={t("jobs.noSignalsBody")}
          action={
            <Link href="/profile/skills" className={buttonClasses({ pill: true })}>
              {t("jobs.addSkills")}
            </Link>
          }
        />
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Briefcase />} title={t("jobs.noStrong")} description={t("jobs.noStrongBody")} />
      ) : (
        TIERS.map((tier) => {
          const list = jobs.filter((j) => j.match && matchTier(j.match.score) === tier.key);
          if (!list.length) return null;
          return (
            <section key={tier.key} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-lg font-semibold">{t(tier.title)}</h2>
                <span className="text-sm text-fg-subtle">
                  {t(tier.hint)} · {list.length}
                </span>
              </div>
              {list.map((job) => (
                <JobCard key={job.id} job={job} signedIn />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
