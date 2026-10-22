"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import { BellPlus, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { Chip } from "@/components/ui/controls";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { SkillSearch } from "@/components/skills/skill-search";
import { toast } from "@/components/ui/toast";
import { saveSearchAction } from "@/server/actions/jobs";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_MODES } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { industryName } from "@/i18n/translate";
import { toQueryString, type JobSearchParams } from "@/lib/validation/search";
import { cn } from "@/lib/utils";

const SALARIES = [30000, 50000, 75000, 100000, 150000];

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function useJobSearchNav(params: JobSearchParams) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (overrides: Partial<JobSearchParams>) =>
    start(() => router.push(`/jobs${toQueryString(params, { ...overrides, page: overrides.page ?? 1 })}`, { scroll: false }));
  return { go, pending };
}

export function JobSearchBar({ params }: { params: JobSearchParams }) {
  const { go, pending } = useJobSearchNav(params);
  const { t } = useI18n();
  const [q, setQ] = useState(params.q ?? "");
  const [location, setLocation] = useState(params.location ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go({ q: q.trim() || undefined, location: location.trim() || undefined });
      }}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 shadow-card transition-[border-color,box-shadow] duration-200 focus-within:border-brand/40 focus-within:shadow-float sm:flex-row sm:items-center sm:gap-0"
    >
      <label className="flex flex-1 items-center gap-2.5 px-3">
        <Search className="size-4 shrink-0 text-fg-subtle" />
        <input type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("jobs.keywords")} aria-label={t("jobs.keywords")} className="h-10 w-full bg-transparent text-sm outline-none" />
      </label>
      <label className="flex flex-1 items-center gap-2.5 border-border px-3 sm:border-s">
        <MapPin className="size-4 shrink-0 text-fg-subtle" />
        <input type="search" name="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("jobs.where")} aria-label={t("jobs.location")} className="h-10 w-full bg-transparent text-sm outline-none" />
      </label>
      <Button type="submit" loading={pending} className="sm:ms-1">
        {t("common.search")}
      </Button>
    </form>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{title}</h3>
      {children}
    </div>
  );
}

function FilterBody({ params, industries, skillNames }: { params: JobSearchParams; industries: { slug: string; name: string }[]; skillNames: Record<string, string> }) {
  const { go } = useJobSearchNav(params);
  const { t, f } = useI18n();
  return (
    <div className="space-y-6">
      <FilterGroup title={t("jobs.workMode")}>
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((m) => (
            <Chip key={m} selected={params.mode.includes(m)} onClick={() => go({ mode: toggle(params.mode, m) })}>
              {t(`enums.workMode.${m}`)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("jobs.jobType")}>
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((et) => (
            <Chip key={et} selected={params.type.includes(et)} onClick={() => go({ type: toggle(params.type, et) })}>
              {t(`enums.employmentType.${et}`)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("jobs.level")}>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_LEVELS.map((l) => (
            <Chip key={l} selected={params.level.includes(l)} onClick={() => go({ level: toggle(params.level, l) })}>
              {t(`enums.experienceLevel.${l}`)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("jobs.minSalary")}>
        <Select value={params.salary ?? ""} onChange={(e) => go({ salary: e.target.value ? Number(e.target.value) : undefined })} aria-label={t("jobs.minSalary")}>
          <option value="">{t("jobs.anySalary")}</option>
          {SALARIES.map((s) => (
            <option key={s} value={s}>
              {f.number(s)}+
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup title={t("jobs.industry")}>
        <Select value={params.industry ?? ""} onChange={(e) => go({ industry: e.target.value || undefined })} aria-label={t("jobs.industry")}>
          <option value="">{t("jobs.allIndustries")}</option>
          {industries.map((i) => (
            <option key={i.slug} value={i.slug}>
              {industryName(t, i.name)}
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup title={t("jobs.posted")}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              [undefined, "jobs.anyTime"],
              ["1", "jobs.day"],
              ["7", "jobs.week"],
              ["30", "jobs.month"],
            ] as const
          ).map(([v, label]) => (
            <Chip key={label} selected={params.posted === v} onClick={() => go({ posted: v })}>
              {t(label)}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title={t("jobs.skills")}>
        <SkillSearch
          exclude={[]}
          placeholder={t("skills.requireSkill")}
          onSelect={(s) => !params.skills.includes(s.slug) && go({ skills: [...params.skills, s.slug] })}
        />
        {params.skills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {params.skills.map((slug) => (
              <Chip key={slug} selected onClick={() => go({ skills: params.skills.filter((s) => s !== slug) })}>
                {skillNames[slug] ?? slug} <X className="size-3" />
              </Chip>
            ))}
          </div>
        )}
      </FilterGroup>
    </div>
  );
}

export function JobFilters(props: { params: JobSearchParams; industries: { slug: string; name: string }[]; skillNames: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const active =
    props.params.mode.length + props.params.type.length + props.params.level.length + props.params.skills.length + (props.params.salary ? 1 : 0) + (props.params.industry ? 1 : 0) + (props.params.posted ? 1 : 0);
  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">{t("jobs.filters")}</h2>
            {active > 0 && <ClearFilters params={props.params} />}
          </div>
          <FilterBody {...props} />
        </div>
      </aside>
      <div className="lg:hidden">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <SlidersHorizontal /> {t("jobs.filters")} {active > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] text-brand-fg">{active}</span>}
        </Button>
        <Dialog open={open} onOpenChange={setOpen} title={t("jobs.filters")} footer={<Button onClick={() => setOpen(false)}>{t("common.showResults")}</Button>}>
          <FilterBody {...props} />
        </Dialog>
      </div>
    </>
  );
}

function ClearFilters({ params }: { params: JobSearchParams }) {
  const { go } = useJobSearchNav(params);
  const { t } = useI18n();
  return (
    <button onClick={() => go({ mode: [], type: [], level: [], skills: [], salary: undefined, industry: undefined, posted: undefined })} className="text-xs font-medium text-brand-soft-fg hover:underline">
      {t("common.clearAll")}
    </button>
  );
}

export function SortSelect({ params, signedIn }: { params: JobSearchParams; signedIn: boolean }) {
  const { go, pending } = useJobSearchNav(params);
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-2 text-sm transition-opacity", pending && "opacity-60")}>
      <span className="text-fg-muted">{t("jobs.sort")}</span>
      <select
        value={params.sort}
        onChange={(e) => go({ sort: e.target.value as JobSearchParams["sort"] })}
        className="h-9 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
        aria-label={t("jobs.sort")}
      >
        <option value="relevant">{t("jobs.sortRelevant")}</option>
        {signedIn && <option value="match">{t("jobs.sortMatch")}</option>}
        <option value="newest">{t("jobs.sortNewest")}</option>
        <option value="salary">{t("jobs.sortSalary")}</option>
      </select>
    </div>
  );
}

export function SaveSearchButton({ params }: { params: JobSearchParams }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [name, setName] = useState(params.q ? `${params.q}${params.location ? ` · ${params.location}` : ""}` : t("jobs.tabSearch"));
  const [alerts, setAlerts] = useState(true);
  const [pending, start] = useTransition();
  const { page: _page, ...rest } = params;
  void _page;
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))) as Record<string, string | number | string[]>;
  return (
    <>
      <Button variant="soft" size="sm" onClick={() => setOpen(true)}>
        <BellPlus /> {t("jobs.saveSearch")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("jobs.saveSearchTitle")}
        description={t("jobs.saveSearchDesc")}
        size="sm"
        footer={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await saveSearchAction({ kind: "JOB", name, params: clean, alertsEnabled: alerts });
                if (res?.ok) {
                  toast.success(t("jobs.searchSaved"));
                  setOpen(false);
                } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
              })
            }
          >
            {t("jobs.saveSearch")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("jobs.name")}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}</Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            {t("jobs.notifyNew")}
          </label>
        </div>
      </Dialog>
    </>
  );
}

export function ActiveFilterSummary({ total, params }: { total: number; params: JobSearchParams }) {
  const { t } = useI18n();
  return (
    <AnimatePresence mode="wait">
      <m.p key={total} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-fg-muted">
        <span className="font-semibold text-fg">{t("jobs.count", { n: total })}</span>
        {params.q && (
          <>
            {" "}
            {t("jobs.for")} <span className="font-medium text-fg">“{params.q}”</span>
          </>
        )}
        {params.location && (
          <>
            {" "}
            {t("jobs.in")} <span className="font-medium text-fg">{params.location}</span>
          </>
        )}
      </m.p>
    </AnimatePresence>
  );
}
