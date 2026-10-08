"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createCompanyAction } from "@/server/actions/companies";
import { COMPANY_SIZES, type CompanySize } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { localizedCountries } from "@/i18n/countries";
import { industryName } from "@/i18n/translate";

export function RecruiterSetupForm({ industries }: { industries: { id: string; name: string }[] }) {
  const router = useRouter();
  const { t, f } = useI18n();
  const [v, setV] = useState({ name: "", website: "", industryId: "", size: "SIZE_11_50" as CompanySize, city: "", countryCode: "", tagline: "", title: "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Field label={t("onboarding.companyName")} error={errors.name}>
        {(p) => <Input {...p} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} />}
      </Field>
      <Field label={t("recruiter.tagline")} optional>
        {(p) => <Input {...p} value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} maxLength={160} placeholder={t("recruiter.taglinePh")} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboarding.website")} optional error={errors.website}>
          {(p) => <Input {...p} type="url" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://" />}
        </Field>
        <Field label={t("onboarding.yourTitle")} optional>
          {(p) => <Input {...p} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={80} />}
        </Field>
        <Field label={t("onboarding.industry")}>
          {(p) => (
            <Select {...p} value={v.industryId} onChange={(e) => setV({ ...v, industryId: e.target.value })}>
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
            <Select {...p} value={v.size} onChange={(e) => setV({ ...v, size: e.target.value as CompanySize })}>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {t(`enums.companySize.${s}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("onboarding.city")} optional>
          {(p) => <Input {...p} value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} maxLength={60} />}
        </Field>
        <Field label={t("onboarding.country")} optional>
          {(p) => (
            <Select {...p} value={v.countryCode} onChange={(e) => setV({ ...v, countryCode: e.target.value })}>
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
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await createCompanyAction({ ...v, industryId: v.industryId || null, countryCode: v.countryCode || null });
            if (res?.ok) {
              toast.success(t("recruiter.created"));
              router.push("/recruiter");
              router.refresh();
            } else {
              setErrors(res && !res.ok ? (res.fieldErrors ?? {}) : {});
              toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
            }
          })
        }
      >
        <Building2 /> {t("recruiter.createWorkspace")}
      </Button>
    </div>
  );
}
