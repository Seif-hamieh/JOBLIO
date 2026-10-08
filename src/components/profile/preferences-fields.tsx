"use client";

import { useI18n } from "@/i18n/client";
import { industryName } from "@/i18n/translate";
import { Chip, Switch } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import {
  AVAILABILITIES,
  EMPLOYMENT_TYPES,
  SALARY_PERIODS,
  WORK_MODES,
  type Availability,
  type EmploymentType,
  type SalaryPeriod,
  type WorkMode,
} from "@/lib/constants";

export type Preferences = {
  openToWork: boolean;
  availability: Availability;
  desiredTitles: string[];
  preferredWorkModes: WorkMode[];
  preferredEmploymentTypes: EmploymentType[];
  preferredCities: string[];
  openToRelocate: boolean;
  desiredSalaryMin: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  industryIds: string[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  openToWork: true,
  availability: "ONE_MONTH",
  desiredTitles: [],
  preferredWorkModes: [],
  preferredEmploymentTypes: ["FULL_TIME"],
  preferredCities: [],
  openToRelocate: false,
  desiredSalaryMin: null,
  salaryCurrency: "USD",
  salaryPeriod: "YEAR",
  industryIds: [],
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "INR", "CAD", "AUD", "SGD", "JPY", "BRL", "NGN"];

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function PreferencesFields({
  value,
  onChange,
  industries,
}: {
  value: Preferences;
  onChange: (v: Preferences) => void;
  industries: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-6">
      <div className="surface flex flex-col gap-4 p-4">
        <Switch
          checked={value.openToWork}
          onCheckedChange={(v) => set("openToWork", v)}
          label={t("prefs.openToWork")}
          description={t("prefs.openToWorkDesc")}
        />
        {value.openToWork && (
          <Field label={t("prefs.availability")}>
            {(p) => (
              <Select {...p} value={value.availability} onChange={(e) => set("availability", e.target.value as Availability)}>
                {AVAILABILITIES.filter((a) => a !== "NOT_LOOKING").map((a) => (
                  <option key={a} value={a}>
                    {t(`enums.availability.${a}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      <Field label={t("prefs.roles")} hint={t("prefs.rolesHint")}>
        {(p) => <TagInput id={p.id} value={value.desiredTitles} onChange={(v) => set("desiredTitles", v)} placeholder={t("prefs.rolesPlaceholder")} />}
      </Field>

      <div>
        <div className="mb-2 text-[13px] font-medium">{t("prefs.workMode")}</div>
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((m) => (
            <Chip key={m} selected={value.preferredWorkModes.includes(m)} onClick={() => set("preferredWorkModes", toggle(value.preferredWorkModes, m))}>
              {t(`enums.workMode.${m}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-medium">{t("prefs.jobType")}</div>
        <div className="flex flex-wrap gap-2">
          {EMPLOYMENT_TYPES.map((et) => (
            <Chip key={et} selected={value.preferredEmploymentTypes.includes(et)} onClick={() => set("preferredEmploymentTypes", toggle(value.preferredEmploymentTypes, et))}>
              {t(`enums.employmentType.${et}`)}
            </Chip>
          ))}
        </div>
      </div>

      <Field label={t("prefs.cities")} hint={t("prefs.citiesHint")} optional>
        {(p) => <TagInput id={p.id} value={value.preferredCities} onChange={(v) => set("preferredCities", v)} placeholder={t("prefs.citiesPlaceholder")} />}
      </Field>
      <Switch checked={value.openToRelocate} onCheckedChange={(v) => set("openToRelocate", v)} label={t("prefs.relocate")} />

      <div className="grid gap-3 sm:grid-cols-[1fr_110px_140px]">
        <Field label={t("prefs.minSalary")} optional>
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={value.desiredSalaryMin ?? ""}
              onChange={(e) => set("desiredSalaryMin", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
              placeholder="60000"
            />
          )}
        </Field>
        <Field label={t("prefs.currency")}>
          {(p) => (
            <Select {...p} value={value.salaryCurrency} onChange={(e) => set("salaryCurrency", e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("prefs.period")}>
          {(p) => (
            <Select {...p} value={value.salaryPeriod} onChange={(e) => set("salaryPeriod", e.target.value as SalaryPeriod)}>
              {SALARY_PERIODS.map((s) => (
                <option key={s} value={s}>
                  {t(`enums.salaryPeriod.${s}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {industries.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-medium">
            {t("prefs.industries")} <span className="font-normal text-fg-subtle">{t("prefs.upTo5")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {industries.map((i) => (
              <Chip
                key={i.id}
                selected={value.industryIds.includes(i.id)}
                onClick={() => {
                  if (!value.industryIds.includes(i.id) && value.industryIds.length >= 5) return;
                  set("industryIds", toggle(value.industryIds, i.id));
                }}
              >
                {industryName(t, i.name)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
