"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Switch } from "@/components/ui/controls";
import { Input, Select } from "@/components/ui/field";
import { SkillSearch } from "@/components/skills/skill-search";
import { toast } from "@/components/ui/toast";
import { saveSearchAction } from "@/server/actions/jobs";
import { AVAILABILITIES, EDUCATION_LEVELS, SKILL_LEVELS } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { LANGUAGES } from "@/lib/geo";
import { toQueryString, type CandidateSearchParams } from "@/lib/validation/search";
import { cn } from "@/lib/utils";

const DEFAULTS = { page: 1, sort: "match" };

function Group({ title, locked, children }: { title: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(locked && "pointer-events-none opacity-50")}>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        {title} {locked && <Lock className="size-3" />}
      </h3>
      {children}
    </div>
  );
}

export function CandidateFilters({
  params,
  pro,
  jobs,
  skillNames,
}: {
  params: CandidateSearchParams;
  pro: boolean;
  jobs: { id: string; title: string }[];
  skillNames: Record<string, string>;
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const languages = LANGUAGES.map((l) => ({ code: l.code, name: f.language(l.code) })).sort((a, b) => a.name.localeCompare(b.name, f.locale));
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.q ?? "");
  const [location, setLocation] = useState(params.location ?? "");
  const go = (o: Partial<CandidateSearchParams>) => start(() => router.push(`/recruiter/candidates${toQueryString(params, { ...o, page: o.page ?? 1 }, DEFAULTS)}`, { scroll: false }));

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-70")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q || undefined, location: location || undefined });
        }}
        className="space-y-2"
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("recruiter.keywords")} className="ps-9" aria-label={t("recruiter.keywords")} />
        </label>
        <label className="relative block">
          <MapPin className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("landing.searchWhere")} className="ps-9" aria-label={t("jobs.location")} />
        </label>
        <Button type="submit" className="w-full" loading={pending}>
          {t("common.search")}
        </Button>
      </form>

      <Group title={t("recruiter.rankAgainst")}>
        <Select value={params.job ?? ""} onChange={(e) => go({ job: e.target.value || undefined })} aria-label={t("recruiter.rankAgainst")}>
          <option value="">{t("recruiter.noJobSelected")}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </Select>
      </Group>

      <Group title={t("jobs.skills")}>
        <SkillSearch placeholder={t("skills.requireSkill")} onSelect={(s) => !params.skills.includes(s.slug) && go({ skills: [...params.skills, s.slug] })} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {params.skills.map((slug) => (
            <Chip key={slug} selected onClick={() => go({ skills: params.skills.filter((s) => s !== slug) })}>
              {skillNames[slug] ?? slug} <X className="size-3" />
            </Chip>
          ))}
        </div>
      </Group>

      <Group title={t("recruiter.minExperience")}>
        <Select value={params.minYears ?? ""} onChange={(e) => go({ minYears: e.target.value ? Number(e.target.value) : undefined })} aria-label={t("recruiter.minExperience")}>
          <option value="">{t("common.any")}</option>
          {[1, 2, 3, 5, 8, 10].map((y) => (
            <option key={y} value={y}>
              {t("recruiter.yearsPlus", { n: y })}
            </option>
          ))}
        </Select>
      </Group>

      <div className="space-y-3">
        <Switch checked={!!params.openToWork} onCheckedChange={(v) => go({ openToWork: v ? "1" : undefined })} label={t("recruiter.openToWorkOnly")} />
        <Switch checked={!!params.remote} onCheckedChange={(v) => go({ remote: v ? "1" : undefined })} label={t("recruiter.openToRemote")} />
      </div>

      <div className="space-y-5 rounded-2xl border border-ember/25 bg-ember-soft/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ember-fg">{t("recruiter.advanced")}</span>
          {!pro && (
            <Link href="/premium#business" className="text-xs font-semibold text-ember-fg underline">
              {t("footer.recruiterPro")}
            </Link>
          )}
        </div>
        <Group title={t("recruiter.skillLevelFilter")} locked={!pro}>
          <Select value={params.skillLevel ?? ""} onChange={(e) => go({ skillLevel: (e.target.value || undefined) as CandidateSearchParams["skillLevel"] })} aria-label={t("recruiter.skillLevelFilter")}>
            <option value="">{t("recruiter.anyLevel")}</option>
            {SKILL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`enums.skillLevel.${l}`)}+
              </option>
            ))}
          </Select>
        </Group>
        <Group title={t("recruiter.education")} locked={!pro}>
          <Select value={params.education ?? ""} onChange={(e) => go({ education: (e.target.value || undefined) as CandidateSearchParams["education"] })} aria-label={t("recruiter.education")}>
            <option value="">{t("common.any")}</option>
            {EDUCATION_LEVELS.filter((l) => l !== "NONE").map((l) => (
              <option key={l} value={l}>
                {t(`enums.educationLevel.${l}`)}+
              </option>
            ))}
          </Select>
        </Group>
        <Group title={t("recruiter.languages")} locked={!pro}>
          <Select value="" onChange={(e) => e.target.value && !params.languages.includes(e.target.value) && go({ languages: [...params.languages, e.target.value] })} aria-label={t("profileEdit.addLanguage")}>
            <option value="">{t("profileEdit.addLanguage")}</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {params.languages.map((c) => (
              <Chip key={c} selected onClick={() => go({ languages: params.languages.filter((x) => x !== c) })}>
                {f.language(c)} <X className="size-3" />
              </Chip>
            ))}
          </div>
        </Group>
        <Group title={t("recruiter.availability")} locked={!pro}>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABILITIES.filter((a) => a !== "NOT_LOOKING").map((a) => (
              <Chip key={a} selected={params.availability.includes(a)} onClick={() => go({ availability: params.availability.includes(a) ? params.availability.filter((x) => x !== a) : [...params.availability, a] })}>
                {t(`enums.availability.${a}`)}
              </Chip>
            ))}
          </div>
        </Group>
        <Group title={t("recruiter.salaryUpTo")} locked={!pro}>
          <Select value={params.maxSalary ?? ""} onChange={(e) => go({ maxSalary: e.target.value ? Number(e.target.value) : undefined })} aria-label={t("recruiter.salaryUpTo")}>
            <option value="">{t("common.any")}</option>
            {[40000, 60000, 80000, 100000, 130000, 160000].map((s) => (
              <option key={s} value={s}>
                {f.number(s)}
              </option>
            ))}
          </Select>
        </Group>
      </div>

      {pro && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            start(async () => {
              const { page: _p, ...rest } = params;
              void _p;
              const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))) as Record<string, string | number | string[]>;
              const res = await saveSearchAction({ kind: "CANDIDATE", name: params.q || t("recruiter.searchCandidates"), params: clean });
              if (res?.ok) toast.success(t("jobs.searchSaved"));
              else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
            })
          }
        >
          {t("recruiter.saveThisSearch")}
        </Button>
      )}
    </div>
  );
}
