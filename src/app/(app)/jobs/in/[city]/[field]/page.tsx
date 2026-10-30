import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { landingFor, landingPages } from "@/server/services/job-landing";
import { decodeSlug, JobLanding } from "@/components/jobs/job-landing";

// /jobs/in/<city>/<field> — open jobs in one city and one field (industry); 404 when there are none.
export async function generateMetadata({ params }: PageProps<"/jobs/in/[city]/[field]">): Promise<Metadata> {
  const { city, field } = await params;
  const page = await landingFor(decodeSlug(city), decodeSlug(field));
  if (!page?.field) return {};
  const { t } = await getI18n();
  const title = t("jobs.landingCityCategory", { category: page.field.name, city: page.city.name });
  const description = t("jobs.landingDescPair", { n: page.field.count, category: page.field.name, city: page.city.name });
  return {
    title,
    description,
    alternates: { canonical: `/jobs/in/${encodeURIComponent(page.city.slug)}/${encodeURIComponent(page.field.slug)}` },
    openGraph: { title, description },
  };
}

export default async function CityFieldJobsPage({ params }: PageProps<"/jobs/in/[city]/[field]">) {
  const { city, field } = await params;
  const [page, cities] = await Promise.all([landingFor(decodeSlug(city), decodeSlug(field)), landingPages()]);
  if (!page?.field) notFound();
  return <JobLanding city={page.city} field={page.field} cities={cities} />;
}
