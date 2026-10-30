import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { landingFor, landingPages } from "@/server/services/job-landing";
import { decodeSlug, JobLanding } from "@/components/jobs/job-landing";

// /jobs/in/<city> — open jobs in one city (404 when it has none, so no empty pages get indexed).
export async function generateMetadata({ params }: PageProps<"/jobs/in/[city]">): Promise<Metadata> {
  const page = await landingFor(decodeSlug((await params).city));
  if (!page) return {};
  const { t } = await getI18n();
  const title = t("jobs.landingCity", { city: page.city.name });
  const description = t("jobs.landingDescCity", { n: page.city.count, city: page.city.name });
  return { title, description, alternates: { canonical: `/jobs/in/${encodeURIComponent(page.city.slug)}` }, openGraph: { title, description } };
}

export default async function CityJobsPage({ params }: PageProps<"/jobs/in/[city]">) {
  const [page, cities] = await Promise.all([landingFor(decodeSlug((await params).city)), landingPages()]);
  if (!page) notFound();
  return <JobLanding city={page.city} cities={cities} />;
}
