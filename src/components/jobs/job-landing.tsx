import Link from "next/link";
import { MapPin } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { getViewer } from "@/server/session";
import { landingJobs, type landingPages } from "@/server/services/job-landing";
import { JobCard } from "@/components/jobs/job-card";
import { jsonLdScript } from "@/lib/job-posting-ld";
import { APP_URL } from "@/lib/utils";

type City = Awaited<ReturnType<typeof landingPages>>[number];

/** Route params arrive URL-encoded for non-Latin slugs (Arabic city names). */
export const decodeSlug = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * A city (or city + field) landing page: heading, the open jobs, then links to the city's fields and to other
 * cities, so search engines can reach every page from any of them. Plain server-rendered HTML, no sign-in.
 */
export async function JobLanding({ city, field, cities }: { city: City; field?: City["fields"][number]; cities: City[] }) {
  const [{ t }, viewer, jobs] = await Promise.all([getI18n(), getViewer(), landingJobs(city.name, field?.slug)]);
  const title = field ? t("jobs.landingCityCategory", { category: field.name, city: city.name }) : t("jobs.landingCity", { city: city.name });
  const base = `/jobs/in/${encodeURIComponent(city.slug)}`;
  const crumbs = [
    { name: t("jobs.allJobs"), url: `${APP_URL}/jobs` },
    { name: t("jobs.landingCity", { city: city.name }), url: `${APP_URL}${base}` },
    ...(field ? [{ name: field.name, url: `${APP_URL}${base}/${encodeURIComponent(field.slug)}` }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
          }),
        }}
      />
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted" aria-label="Breadcrumb">
        <Link href="/jobs" className="hover:text-fg">
          {t("jobs.allJobs")}
        </Link>
        <span>/</span>
        <Link href="/jobs/in" className="hover:text-fg">
          {t("jobs.landingIndexTitle")}
        </Link>
        <span>/</span>
        {field ? (
          <Link href={base} className="hover:text-fg">
            {city.name}
          </Link>
        ) : (
          <span className="text-fg">{city.name}</span>
        )}
      </nav>
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("jobs.landingCount", { n: field?.count ?? city.count })}</p>
      </header>

      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} signedIn={!!viewer} />
        ))}
      </div>

      {city.fields.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("jobs.landingByCategory", { city: city.name })}</h2>
          <div className="flex flex-wrap gap-2">
            {city.fields.map((f) => (
              <Link
                key={f.slug}
                href={`${base}/${encodeURIComponent(f.slug)}`}
                aria-current={f.slug === field?.slug ? "page" : undefined}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-fg-muted transition hover:border-brand/50 hover:text-fg aria-[current=page]:border-brand aria-[current=page]:text-brand-soft-fg"
              >
                {f.name} · {f.count}
              </Link>
            ))}
          </div>
        </section>
      )}

      <CityLinks cities={cities.filter((c) => c.slug !== city.slug)} title={t("jobs.landingOtherCities")} />
    </div>
  );
}

/** Links to city pages (the busiest first). */
export function CityLinks({ cities, title }: { cities: City[]; title: string }) {
  if (!cities.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cities.slice(0, 60).map((c) => (
          <Link key={c.slug} href={`/jobs/in/${encodeURIComponent(c.slug)}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5 text-sm transition hover:border-brand/50">
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="size-4 shrink-0 text-fg-subtle" />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="text-xs text-fg-subtle">{c.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
