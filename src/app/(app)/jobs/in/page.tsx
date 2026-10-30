import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { landingPages } from "@/server/services/job-landing";
import { CityLinks } from "@/components/jobs/job-landing";

// /jobs/in — every city with open jobs, linking to its landing page.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("jobs.landingIndexTitle"), description: t("jobs.landingIndexDesc"), alternates: { canonical: "/jobs/in" } };
}

export default async function JobsByCityPage() {
  const [{ t }, cities] = await Promise.all([getI18n(), landingPages()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("jobs.landingIndexTitle")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("jobs.landingIndexDesc")}</p>
      </header>
      <CityLinks cities={cities} title={t("jobs.browseByCity")} />
    </div>
  );
}
