"use client";

import { useI18n } from "@/i18n/client";
import { industryName } from "@/i18n/translate";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Check, PartyPopper, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SkillSearch, type SkillOption } from "@/components/skills/skill-search";
import { LevelPicker } from "@/components/skills/level-picker";
import { PreferencesFields, DEFAULT_PREFERENCES, type Preferences } from "@/components/profile/preferences-fields";
import { completeOnboarding } from "@/server/actions/onboarding";
import { COMPANY_SIZES, type CompanySize, type SkillLevel, type UserIntent } from "@/lib/constants";
import { localizedCountries } from "@/i18n/countries";
import { cn } from "@/lib/utils";
import { INTENT_STORAGE_KEY } from "@/components/auth/register-form";

type Step = "intent" | "basics" | "skills" | "preferences" | "company" | "done";

const INTENTS = [
  { value: "SEEKER" as const, title: "auth.intentSeeker" as const, icon: Search },
  { value: "RECRUITER" as const, title: "auth.intentRecruiter" as const, icon: Briefcase },
  { value: "BOTH" as const, title: "auth.intentBoth" as const, icon: Sparkles },
];

export function OnboardingWizard({
  name,
  initialIntent,
  hasCompany,
  industries,
}: {
  name: string;
  initialIntent: UserIntent;
  hasCompany: boolean;
  industries: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const countries = localizedCountries(f);
  const [intent, setIntent] = useState<UserIntent>(initialIntent);
  const [step, setStep] = useState<Step>("intent");
  const [headline, setHeadline] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [skills, setSkills] = useState<(SkillOption & { level: SkillLevel })[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [company, setCompany] = useState({ name: "", website: "", industryId: "", size: "SIZE_11_50" as CompanySize, title: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Social sign-ups chose their intent before leaving for the provider.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTENT_STORAGE_KEY) as UserIntent | null;
      if (stored && ["SEEKER", "RECRUITER", "BOTH"].includes(stored)) setIntent(stored);
    } catch {}
  }, []);

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = ["intent", "basics"];
    if (intent !== "RECRUITER") s.push("skills", "preferences");
    if (intent !== "SEEKER" && !hasCompany) s.push("company");
    return s;
  }, [intent, hasCompany]);
  const index = steps.indexOf(step);
  const progress = step === "done" ? 100 : ((index + 1) / (steps.length + 1)) * 100;

  function next() {
    setError(null);
    if (step === "basics" && headline.trim().length < 2) return setError(t("onboarding.errHeadline"));
    if (step === "company" && company.name.trim().length < 2) return setError(t("onboarding.errCompany"));
    const n = steps[index + 1];
    if (n) setStep(n);
    else submit();
  }

  function submit() {
    start(async () => {
      const res = await completeOnboarding({
        intent,
        headline,
        city: city || null,
        countryCode: countryCode || null,
        skills: skills.map((s) => ({ skillId: s.id, level: s.level })),
        preferences: intent !== "RECRUITER" ? prefs : undefined,
        company: intent !== "SEEKER" && !hasCompany ? { ...company, industryId: company.industryId || null, website: company.website || null, city: city || null, countryCode: countryCode || null, tagline: null, title: company.title || null } : undefined,
      });
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : t("common.somethingWrong"));
        return;
      }
      try {
        localStorage.removeItem(INTENT_STORAGE_KEY);
      } catch {}
      setStep("done");
      setTimeout(() => {
        router.replace(intent === "RECRUITER" ? "/recruiter" : "/home");
        router.refresh();
      }, 1600);
    });
  }

  const first = name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <m.div className="h-full rounded-full bg-gradient-to-r from-brand to-aurora" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>

      <AnimatePresence mode="wait">
        <m.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
          {step === "intent" && (
            <section>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t("onboarding.welcome", { name: first })}</h1>
              <p className="mt-2 text-fg-muted">{t("auth.howUse")}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {INTENTS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setIntent(o.value)}
                    aria-pressed={intent === o.value}
                    className={cn(
                      "flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all",
                      intent === o.value ? "border-brand bg-brand-soft/60 shadow-card" : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <span className={cn("grid size-12 place-items-center rounded-2xl", intent === o.value ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-muted")}>
                      <o.icon className="size-5" />
                    </span>
                    <span className="font-semibold">{t(o.title)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === "basics" && (
            <section className="space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">{t("onboarding.identityTitle")}</h1>
                <p className="mt-2 text-fg-muted">{t("onboarding.identitySub")}</p>
              </div>
              <Field label={t("onboarding.headline")} hint={t("onboarding.headlineHint")}>
                {(p) => <Input {...p} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={160} autoFocus />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("onboarding.city")}>{(p) => <Input {...p} value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder={t("prefs.citiesPlaceholder")} />}</Field>
                <Field label={t("onboarding.country")}>
                  {(p) => (
                    <Select {...p} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                      <option value="">{t("common.select")}</option>
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </section>
          )}

          {step === "skills" && (
            <section>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t("onboarding.skillsTitle")}</h1>
              <p className="mt-2 text-fg-muted">{t("onboarding.skillsSub")}</p>
              <SkillSearch
                className="mt-6"
                exclude={skills.map((s) => s.id)}
                onSelect={(s) => skills.length < 50 && setSkills((list) => [...list, { ...s, level: "INTERMEDIATE" }])}
              />
              <ul className="mt-4 space-y-2">
                <AnimatePresence initial={false}>
                  {skills.map((s) => (
                    <m.li
                      key={s.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5"
                    >
                      <span className="flex-1 text-sm font-medium">{s.name}</span>
                      <LevelPicker value={s.level} onChange={(level) => setSkills((list) => list.map((x) => (x.id === s.id ? { ...x, level } : x)))} size="sm" />
                      <button type="button" onClick={() => setSkills((list) => list.filter((x) => x.id !== s.id))} className="rounded-full p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label={`${t("common.remove")} ${s.name}`}>
                        <X className="size-4" />
                      </button>
                    </m.li>
                  ))}
                </AnimatePresence>
              </ul>
              {skills.length === 0 && <p className="mt-4 text-sm text-fg-subtle">{t("onboarding.skillsTip")}</p>}
            </section>
          )}

          {step === "preferences" && (
            <section>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t("onboarding.prefsTitle")}</h1>
              <p className="mb-6 mt-2 text-fg-muted">{t("onboarding.prefsSub")}</p>
              <PreferencesFields value={prefs} onChange={setPrefs} industries={industries} />
            </section>
          )}

          {step === "company" && (
            <section className="space-y-5">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">{t("onboarding.companyTitle")}</h1>
                <p className="mt-2 text-fg-muted">{t("onboarding.companySub")}</p>
              </div>
              <Field label={t("onboarding.companyName")}>{(p) => <Input {...p} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} maxLength={80} />}</Field>
              <Field label={t("onboarding.yourTitle")} optional>
                {(p) => <Input {...p} value={company.title} onChange={(e) => setCompany({ ...company, title: e.target.value })} maxLength={80}  />}
              </Field>
              <Field label={t("onboarding.website")} optional>
                {(p) => <Input {...p} type="url" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} placeholder="https://" />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("onboarding.industry")}>
                  {(p) => (
                    <Select {...p} value={company.industryId} onChange={(e) => setCompany({ ...company, industryId: e.target.value })}>
                      <option value="">{t("common.select")}</option>
                      {industries.map((i) => (
                        <option key={i.id} value={i.id}>
                          {industryName(t, i.name)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t("onboarding.size")}>
                  {(p) => (
                    <Select {...p} value={company.size} onChange={(e) => setCompany({ ...company, size: e.target.value as CompanySize })}>
                      {COMPANY_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {t(`enums.companySize.${s}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </section>
          )}

          {step === "done" && (
            <section className="py-10 text-center">
              <m.div
                initial={{ scale: 0.4, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
                className="mx-auto grid size-20 place-items-center rounded-3xl bg-mint-soft text-mint-fg"
              >
                <PartyPopper className="size-9" />
              </m.div>
              <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{t("onboarding.allSet")}</h1>
              <p className="mt-2 text-fg-muted">{t("onboarding.redirecting")}</p>
            </section>
          )}
        </m.div>
      </AnimatePresence>

      {step !== "done" && (
        <>
          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-fg">
              {error}
            </p>
          )}
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(steps[index - 1] ?? "intent")} disabled={index === 0} className={cn(index === 0 && "invisible")}>
              <ArrowLeft /> {t("common.back")}
            </Button>
            <Button onClick={next} loading={pending} size="lg" pill>
              {index === steps.length - 1 ? (
                <>
                  {t("common.finish")} <Check />
                </>
              ) : (
                <>
                  {t("common.next")} <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
