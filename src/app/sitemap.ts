import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { APP_URL } from "@/lib/utils";

// Rebuilt at most once an hour.
export const revalidate = 3600;

const STATIC: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/jobs", priority: 0.9, changeFrequency: "daily" },
  { path: "/jobs/featured", priority: 0.7, changeFrequency: "daily" },
  { path: "/companies", priority: 0.8, changeFrequency: "daily" },
  { path: "/professionals/featured", priority: 0.6, changeFrequency: "daily" },
  { path: "/premium", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

/** Public pages, open jobs, company pages and public profiles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC.map((s) => ({ url: `${APP_URL}${s.path === "/" ? "" : s.path}`, lastModified: now, changeFrequency: s.changeFrequency, priority: s.priority }));
  // A sitemap must never fail the build or the request: without the database, list the static pages only.
  try {
    const [jobs, companies, people] = await Promise.all([
      db.job.findMany({ where: { status: "OPEN" }, select: { id: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 5000 }),
      db.company.findMany({ select: { slug: true, updatedAt: true }, orderBy: { followerCount: "desc" }, take: 5000 }),
      db.user.findMany({
        where: { username: { not: null }, profile: { visibility: "PUBLIC" } },
        select: { username: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 10000,
      }),
    ]);
    return [
      ...pages,
      ...jobs.map((j) => ({ url: `${APP_URL}/jobs/${j.id}`, lastModified: j.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...companies.map((c) => ({ url: `${APP_URL}/companies/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
      ...people.map((u) => ({ url: `${APP_URL}/in/${u.username}`, lastModified: u.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
    ];
  } catch (e) {
    console.error("[sitemap] database unavailable, listing static pages only:", e);
    return pages;
  }
}
