import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { jobCardSelect } from "@/server/services/jobs";
import { SITEMAP_TAG } from "@/server/sitemap";

// Landing pages for search engines: /jobs/in/<city> and /jobs/in/<city>/<field> (field = industry). Only cities and
// fields that have open jobs right now get a page, so there are no empty pages for Google to index. The list of
// pages is cached for an hour and refreshed with the sitemap (a job published or closed).

/** "Beirut" → "beirut", "São Paulo" → "sao-paulo". */
export const citySlug = (city: string) =>
  city
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const openJob = () => ({ status: "OPEN" as const, publishedAt: { not: null }, OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }] });

/** Every city with open jobs, and every city + field pair: slugs, names and counts. */
async function buildLandingPages() {
  {
    const rows = await db.job.groupBy({ by: ["city", "industryId"], where: { ...openJob(), city: { not: null } }, _count: { _all: true } });
    const industries = await db.industry.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.industryId).filter((x): x is string => !!x))] } }, select: { id: true, slug: true, name: true } });
    const industryById = new Map(industries.map((i) => [i.id, i]));
    const cities = new Map<string, { slug: string; name: string; count: number; fields: Map<string, { slug: string; name: string; count: number }> }>();
    for (const r of rows) {
      const name = r.city!.trim();
      const slug = citySlug(name);
      if (!slug) continue;
      const city = cities.get(slug) ?? { slug, name, count: 0, fields: new Map() };
      city.count += r._count._all;
      const industry = r.industryId ? industryById.get(r.industryId) : undefined;
      if (industry) {
        const field = city.fields.get(industry.slug) ?? { slug: industry.slug, name: industry.name, count: 0 };
        field.count += r._count._all;
        city.fields.set(industry.slug, field);
      }
      cities.set(slug, city);
    }
    return [...cities.values()]
      .map((c) => ({ slug: c.slug, name: c.name, count: c.count, fields: [...c.fields.values()].sort((a, b) => b.count - a.count) }))
      .sort((a, b) => b.count - a.count);
  }
}

export const landingPages = unstable_cache(buildLandingPages, ["job-landing:v1"], { revalidate: 3600, tags: [SITEMAP_TAG] });

// For src/proxy.ts, which runs before the page and has no data cache: its own copy, at most 10 minutes old.
let memo: { at: number; pages: Promise<Awaited<ReturnType<typeof buildLandingPages>>> } | null = null;

/** Whether /jobs/in/<city>[/<field>] has open jobs (so the proxy can answer a real 404 for one that doesn't). */
export async function landingExists(city: string, field?: string) {
  if (!memo || Date.now() - memo.at > 10 * 60_000) memo = { at: Date.now(), pages: buildLandingPages() };
  const c = (await memo.pages).find((x) => x.slug === city);
  return !!c && (!field || c.fields.some((f) => f.slug === field));
}

/** The page's city (and field), or null when there is no such page (no open jobs there). */
export async function landingFor(citySlugParam: string, fieldSlug?: string) {
  const city = (await landingPages()).find((c) => c.slug === citySlugParam);
  if (!city) return null;
  const field = fieldSlug ? city.fields.find((f) => f.slug === fieldSlug) : undefined;
  if (fieldSlug && !field) return null;
  return { city, field };
}

/** The open jobs for a landing page, newest first (featured first). */
export async function landingJobs(cityName: string, fieldSlug?: string) {
  return db.job.findMany({
    where: { ...openJob(), city: { equals: cityName, mode: "insensitive" }, ...(fieldSlug && { industry: { slug: fieldSlug } }) },
    orderBy: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
    take: 50,
    select: jobCardSelect,
  });
}
