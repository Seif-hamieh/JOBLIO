"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/controls";
import { toast } from "@/components/ui/toast";
import { CompanyLogo } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SkillSearch } from "@/components/skills/skill-search";
import { LevelPicker } from "@/components/skills/level-picker";
import { ScreeningEditor } from "@/components/recruiter/screening-editor";
import { createJobAction, updateJobAction } from "@/server/actions/recruiter";
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  LANGUAGE_PROFICIENCIES,
  SALARY_PERIODS,
  WORK_MODES,
  type EducationLevel,
  type EmploymentType,
  type ExperienceLevel,
  type LanguageProficiency,
  type SalaryPeriod,
} from "@/lib/constants";
import type { JobFormValue } from "@/lib/job-form";
import { LANGUAGES } from "@/lib/geo";
import { useI18n } from "@/i18n/client";
import { localizedCountries } from "@/i18n/countries";
import { industryName } from "@/i18n/translate";

function LineList({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v.length >= 2 && value.length < 15) onChange([...value, v.slice(0, 300)]);
    setDraft("");
  };
  return (
    <div>
      <ul className="space-y-1.5">
        {value.map((line, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-surface-2/70 px-3 py-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
            <span className="flex-1">{line}</span>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-fg-subtle hover:text-fg" aria-label={t("common.remove")}>
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button variant="soft" onClick={add} disabled={draft.trim().length < 2} aria-label={t("common.add")}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}

/** Today as YYYY-MM-DD in the browser's own calendar (the earliest closing date). */
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function JobForm({
  jobId,
  initial,
  company,
  industries,
  isDraft,
}: {
  jobId?: string;
  initial: JobFormValue;
  company: { name: string; logoUrl: string | null };
  industries: { id: string; name: string }[];
  isDraft: boolean;
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const [langCode, setLangCode] = useState("");
  const set = <K extends keyof JobFormValue>(k: K, val: JobFormValue[K]) => {
    setV((x) => ({ ...x, [k]: val }));
    // A field's error disappears as soon as the field is changed (e.g. "Add at least one skill").
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const submit = (publish: boolean) =>
    start(async () => {
      const payload = {
        ...v,
        industryId: v.industryId || null,
        countryCode: v.countryCode || null,
        skills: v.skills.map(({ skillId, required, minLevel }) => ({ skillId, required, minLevel })),
        screeningQuestions: v.screeningQuestions.map(({ questionText, type, options, isRequired }) => ({ questionText, type, options, isRequired })),
        publish,
      };
      const res = jobId ? await updateJobAction(jobId, payload) : await createJobAction(payload);
      if (res?.ok) {
        toast.success(res.message ?? t("common.saved"));
        router.push(publish ? `/recruiter/jobs/${res.data!.id}/pipeline` : "/recruiter");
        router.refresh();
      } else {
        setErrors(res && !res.ok ? (res.fieldErrors ?? {}) : {});
        toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  const required = v.skills.filter((s) => s.required).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card className="space-y-5 p-6">
          <h2 className="font-display text-lg font-semibold">{t("jobForm.theRole")}</h2>
          <Field label={t("jobForm.title")} error={errors.title}>
            {(p) => <Input {...p} value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder={t("jobForm.titlePh")} />}
          </Field>
          <Field label={t("jobForm.summary")} optional hint={t("jobForm.summaryHint")}>
            {(p) => <Input {...p} value={v.summary} onChange={(e) => set("summary", e.target.value)} maxLength={280} />}
          </Field>
          <Field label={t("jobForm.description")} error={errors.description} hint={`${v.description.length}/10000`}>
            {(p) => <Textarea {...p} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={10000} className="min-h-48" placeholder={t("jobForm.descriptionPh")} />}
          </Field>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">{t("jobForm.responsibilities")}</div>
            <LineList value={v.responsibilities} onChange={(x) => set("responsibilities", x)} placeholder={t("jobForm.addLine")} />
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">{t("jobForm.requirements")}</div>
            <LineList value={v.requirements} onChange={(x) => set("requirements", x)} placeholder={t("jobForm.addLine")} />
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">{t("jobForm.benefits")}</div>
            <LineList value={v.benefits} onChange={(x) => set("benefits", x)} placeholder={t("jobForm.addLine")} />
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Sparkles className="size-[18px] text-brand" /> {t("jobForm.skillsTitle")}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{t("jobForm.skillsSub")}</p>
          </div>
          {errors.skills && <p className="text-xs font-medium text-danger-fg">{errors.skills[0]}</p>}
          <SkillSearch
            exclude={v.skills.map((s) => s.skillId)}
            onSelect={(s) => v.skills.length < 20 && set("skills", [...v.skills, { skillId: s.id, name: s.name, required: true, minLevel: "INTERMEDIATE" }])}
          />
          <ul className="space-y-2">
            {v.skills.map((s) => (
              <li key={s.skillId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium">{s.name}</span>
                <Segmented
                  layoutId={`req-${s.skillId}`}
                  value={s.required ? "req" : "nice"}
                  onChange={(val) => set("skills", v.skills.map((x) => (x.skillId === s.skillId ? { ...x, required: val === "req" } : x)))}
                  options={[
                    { value: "req", label: t("jobForm.required") },
                    { value: "nice", label: t("jobForm.nice") },
                  ]}
                />
                <LevelPicker size="sm" value={s.minLevel} onChange={(minLevel) => set("skills", v.skills.map((x) => (x.skillId === s.skillId ? { ...x, minLevel } : x)))} />
                <button type="button" onClick={() => set("skills", v.skills.filter((x) => x.skillId !== s.skillId))} className="text-fg-subtle hover:text-fg" aria-label={`${t("common.remove")} ${s.name}`}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("jobForm.level")}>
              {(p) => (
                <Select {...p} value={v.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value as ExperienceLevel)}>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`enums.experienceLevel.${l}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("jobForm.minYears")}>
              {(p) => <Input {...p} type="number" min={0} max={40} value={v.minYearsExperience} onChange={(e) => set("minYearsExperience", Math.max(0, Number(e.target.value) || 0))} />}
            </Field>
            <Field label={t("jobForm.education")}>
              {(p) => (
                <Select {...p} value={v.educationLevel} onChange={(e) => set("educationLevel", e.target.value as EducationLevel)}>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`enums.educationLevel.${l}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">{t("jobForm.languages")}</div>
            <div className="space-y-2">
              {v.languages.map((l) => (
                <div key={l.languageCode} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2">
                  <span className="flex-1 text-sm">{f.language(l.languageCode)}</span>
                  <select
                    value={l.minProficiency}
                    onChange={(e) => set("languages", v.languages.map((x) => (x.languageCode === l.languageCode ? { ...x, minProficiency: e.target.value as LanguageProficiency } : x)))}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    aria-label={f.language(l.languageCode)}
                  >
                    {LANGUAGE_PROFICIENCIES.map((p) => (
                      <option key={p} value={p}>
                        {t(`enums.proficiency.${p}`)}+
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => set("languages", v.languages.filter((x) => x.languageCode !== l.languageCode))} aria-label={t("common.remove")}>
                    <X className="size-4 text-fg-subtle" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Select value={langCode} onChange={(e) => setLangCode(e.target.value)} aria-label={t("profileEdit.addLanguage")}>
                  <option value="">{t("profileEdit.addLanguage")}</option>
                  {LANGUAGES.filter((l) => !v.languages.some((x) => x.languageCode === l.code)).map((l) => ({ code: l.code, name: f.language(l.code) })).sort((a, b) => a.name.localeCompare(b.name, f.locale)).map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="soft"
                  disabled={!langCode}
                  onClick={() => {
                    set("languages", [...v.languages, { languageCode: langCode, minProficiency: "PROFESSIONAL" }]);
                    setLangCode("");
                  }}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="font-display text-lg font-semibold">{t("jobForm.locTitle")}</h2>
          <div className="flex flex-wrap gap-4">
            <Segmented layoutId="job-mode" value={v.workMode} onChange={(m) => set("workMode", m)} options={WORK_MODES.map((m) => ({ value: m, label: t(`enums.workMode.${m}`) }))} />
            <Select value={v.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)} aria-label={t("profileEdit.employmentType")} className="min-w-44">
              {EMPLOYMENT_TYPES.map((et) => (
                <option key={et} value={et}>
                  {t(`enums.employmentType.${et}`)}
                </option>
              ))}
            </Select>
          </div>
          {v.workMode !== "REMOTE" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("jobForm.city")} error={errors.city}>
                {(p) => <Input {...p} value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />}
              </Field>
              <Field label={t("jobForm.country")}>
                {(p) => (
                  <Select {...p} value={v.countryCode} onChange={(e) => set("countryCode", e.target.value)}>
                    <option value="">{t("common.select")}</option>
                    {localizedCountries(f).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={t("jobForm.salaryFrom")} optional>
              {(p) => <Input {...p} type="number" min={0} value={v.salaryMin ?? ""} onChange={(e) => set("salaryMin", e.target.value === "" ? null : Number(e.target.value))} />}
            </Field>
            <Field label={t("jobForm.salaryTo")} optional error={errors.salaryMax}>
              {(p) => <Input {...p} type="number" min={0} value={v.salaryMax ?? ""} onChange={(e) => set("salaryMax", e.target.value === "" ? null : Number(e.target.value))} />}
            </Field>
            <Field label={t("prefs.currency")}>
              {(p) => (
                <Select {...p} value={v.salaryCurrency} onChange={(e) => set("salaryCurrency", e.target.value)}>
                  {["USD", "EUR", "GBP", "AED", "SAR", "INR", "CAD", "AUD", "SGD", "JPY", "BRL", "NGN"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("prefs.period")}>
              {(p) => (
                <Select {...p} value={v.salaryPeriod} onChange={(e) => set("salaryPeriod", e.target.value as SalaryPeriod)}>
                  {SALARY_PERIODS.map((s) => (
                    <option key={s} value={s}>
                      {t(`enums.salaryPeriod.${s}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <p className="text-xs text-fg-subtle">{t("jobForm.salaryNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("onboarding.industry")} optional>
              {(p) => (
                <Select {...p} value={v.industryId} onChange={(e) => set("industryId", e.target.value)}>
                  <option value="">{t("common.select")}</option>
                  {industries.map((i) => (
                    <option key={i.id} value={i.id}>
                      {industryName(t, i.name)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("jobForm.closes")} optional error={errors.closesAt}>
              {(p) => <Input {...p} type="date" min={todayLocal()} value={v.closesAt} onChange={(e) => set("closesAt", e.target.value)} />}
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("screening.title")}</h2>
            <p className="mt-1 text-sm text-fg-muted">{t("screening.intro")}</p>
          </div>
          <ScreeningEditor value={v.screeningQuestions} onChange={(x) => set("screeningQuestions", x)} error={Object.entries(errors).filter(([k]) => k.startsWith("screeningQuestions")).flatMap(([, e]) => e ?? [])} />
        </Card>
      </div>

      <aside>
        <div className="sticky top-24 space-y-4">
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("jobForm.preview")}</div>
            <div className="mt-3 flex items-start gap-3">
              <CompanyLogo name={company.name} src={company.logoUrl} />
              <div className="min-w-0">
                <div className="font-display font-semibold">{v.title || t("jobForm.title")}</div>
                <div className="text-sm text-fg-muted">{company.name}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge>
                <MapPin /> {v.workMode === "REMOTE" ? t("common.remote") : f.location(v.city, v.countryCode) || t("jobs.location")}
              </Badge>
              <Badge>{t(`enums.employmentType.${v.employmentType}`)}</Badge>
              <Badge>{t(`enums.experienceLevel.${v.experienceLevel}`)}</Badge>
            </div>
            <div className="mt-3 text-sm font-medium">{f.salary(v.salaryMin, v.salaryMax, v.salaryCurrency, v.salaryPeriod) ?? t("landing.salaryUndisclosed")}</div>
            <div className="mt-3 text-xs text-fg-muted">
              {t("jobForm.skillCounts", { req: required, nice: v.skills.length - required })}
            </div>
          </Card>
          <div className="flex flex-col gap-2">
            <Button size="lg" loading={pending} onClick={() => submit(true)}>
              {jobId && !isDraft ? t("jobForm.saveChanges") : t("jobForm.publish")}
            </Button>
            {(!jobId || isDraft) && (
              <Button size="lg" variant="outline" disabled={pending} onClick={() => submit(false)}>
                {t("jobForm.saveDraft")}
              </Button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
