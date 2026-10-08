"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { Check, Minus, X } from "lucide-react";
import { computeMatch, type CandidateFacts, type JobFacts } from "@/lib/matching/engine";
import { MatchRing } from "@/components/match/match-ring";
import { Chip, Segmented } from "@/components/ui/controls";
import { CompanyLogo } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { describeCriterion } from "@/lib/matching/describe";

const SKILLS = [
  { id: "js", name: "JavaScript" },
  { id: "react", name: "React" },
  { id: "ts", name: "TypeScript" },
  { id: "node", name: "Node.js" },
  { id: "graphql", name: "GraphQL" },
  { id: "python", name: "Python" },
];

const JOB: JobFacts = {
  skills: [
    { skillId: "js", name: "JavaScript", required: true, minLevel: "INTERMEDIATE" },
    { skillId: "react", name: "React", required: true, minLevel: "INTERMEDIATE" },
    { skillId: "ts", name: "TypeScript", required: true, minLevel: "INTERMEDIATE" },
    { skillId: "node", name: "Node.js", required: false, minLevel: "INTERMEDIATE" },
    { skillId: "graphql", name: "GraphQL", required: false, minLevel: "BEGINNER" },
  ],
  minYearsExperience: 2,
  educationLevel: "NONE",
  workMode: "REMOTE",
  employmentType: "FULL_TIME",
  city: null,
  countryCode: null,
  salaryMin: 70000,
  salaryMax: 90000,
  salaryCurrency: "USD",
  salaryPeriod: "YEAR",
  languages: [{ code: "en", minProficiency: "PROFESSIONAL" }],
  industryId: null,
};

export function MatchDemo() {
  const { t, f, locale } = useI18n();
  const [skills, setSkills] = useState<string[]>(["js", "react", "ts"]);
  const [years, setYears] = useState(3);
  const [mode, setMode] = useState<"REMOTE" | "ONSITE">("REMOTE");
  const [salary, setSalary] = useState(80);

  const match = useMemo(() => {
    const candidate: CandidateFacts = {
      skills: SKILLS.filter((s) => skills.includes(s.id)).map((s) => ({ skillId: s.id, name: s.name, level: "ADVANCED" as const })),
      yearsExperience: years,
      educationLevel: "BACHELOR",
      city: "Lisbon",
      countryCode: "PT",
      preferredCities: [],
      openToRelocate: false,
      preferredWorkModes: [mode],
      preferredEmploymentTypes: ["FULL_TIME"],
      desiredSalaryMin: salary * 1000,
      salaryCurrency: "USD",
      salaryPeriod: "YEAR",
      languages: [{ code: "en", proficiency: "FLUENT" }],
      preferredIndustryIds: [],
      availability: "IMMEDIATELY",
    };
    return computeMatch(candidate, JOB);
  }, [skills, years, mode, salary]);

  const toggle = (id: string) => setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      {/* Controls: a candidate profile you can edit */}
      <div className="surface p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-subtle">{t("landing.demoProfile")}</div>
        <div className="mt-4">
          <div className="text-sm font-medium">{t("landing.demoSkills")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <Chip key={s.id} selected={skills.includes(s.id)} onClick={() => toggle(s.id)}>
                {skills.includes(s.id) && <Check className="size-3.5" strokeWidth={3} />}
                {s.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <label className="flex items-center justify-between text-sm font-medium" htmlFor="demo-years">
            {t("landing.demoExperience")} <span className="tabular-nums text-fg-muted">{f.years(years)}</span>
          </label>
          <input id="demo-years" type="range" min={0} max={10} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand)]" />
        </div>
        <div className="mt-5">
          <label className="flex items-center justify-between text-sm font-medium" htmlFor="demo-salary">
            {t("landing.demoMinSalary")} <span className="tabular-nums text-fg-muted">{f.salary(salary * 1000, null, "USD", "YEAR")}</span>
          </label>
          <input id="demo-salary" type="range" min={40} max={140} step={5} value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand)]" />
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium">{t("landing.demoWorkMode")}</span>
          <Segmented
            layoutId="demo-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "REMOTE", label: t("enums.workMode.REMOTE") },
              { value: "ONSITE", label: t("enums.workMode.ONSITE") },
            ]}
          />
        </div>
      </div>

      {/* Result: the job and the transparent score */}
      <div className="surface relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--mint)_22%,transparent),transparent_70%)]" />
        <div className="relative flex items-start gap-4">
          <CompanyLogo name="Northwind" color="#2f9fd3" />
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold">{locale === "ar" ? "مهندس واجهات أمامية" : "Frontend Engineer"}</div>
            <div className="text-sm text-fg-muted">Northwind · {t("enums.workMode.REMOTE")} · {t("enums.employmentType.FULL_TIME")} · {f.salary(70000, 90000, "USD", "YEAR")}</div>
            <div className="mt-1 text-xs text-fg-subtle">{t("landing.demoRequires")}</div>
          </div>
          <MatchRing score={match.score} size={68} stroke={6} />
        </div>
        <ul className="relative mt-5 space-y-2">
          <AnimatePresence initial={false}>
            {match.criteria
              .filter((c) => c.status !== "na")
              .map((c) => (
                <m.li
                  key={c.key}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-xl bg-surface-2/70 px-3 py-2"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full",
                      c.status === "met" && "bg-mint-soft text-mint-fg",
                      c.status === "partial" && "bg-ember-soft text-ember-fg",
                      c.status === "missed" && "bg-danger-soft text-danger-fg",
                    )}
                  >
                    {c.status === "met" ? <Check className="size-3" strokeWidth={3} /> : c.status === "partial" ? <Minus className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{t(`match.c.${c.key}`)}</div>
                    <div className="truncate text-xs text-fg-muted">{describeCriterion(c, t, f)}</div>
                  </div>
                  <span className="text-xs tabular-nums text-fg-subtle">
                    {String(c.earned).replace(/\.0$/, "")}/{c.weight}
                  </span>
                </m.li>
              ))}
          </AnimatePresence>
        </ul>
        <p className="relative mt-4 text-xs text-fg-subtle">{t("landing.demoFoot")}</p>
      </div>
    </div>
  );
}
