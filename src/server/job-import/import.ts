import "server-only";
import { db } from "@/server/db";
import { uniqueCompanySlug } from "@/server/services/companies";
import type { JobSource } from "@/generated/prisma/client";
import { type NormalizedJob } from "./normalize";
import { fetchArbeitnow } from "./sources/arbeitnow";
import { fetchJobicy } from "./sources/jobicy";
import { fetchHimalayas } from "./sources/himalayas";

// Daily import from free public job boards. New listings become DRAFT jobs for an admin to review
// and publish (Admin → Jobs). Nothing is ever updated or deleted here: a listing already stored —
// published, draft or closed — is skipped, so admin decisions stick.

const SOURCES: { source: JobSource; fetch: () => Promise<NormalizedJob[]> }[] = [
  { source: "ARBEITNOW", fetch: fetchArbeitnow },
  { source: "JOBICY", fetch: fetchJobicy },
  { source: "HIMALAYAS", fetch: fetchHimalayas },
];

/** New jobs added per source per run, so one run stays well inside the function time limit. */
const MAX_NEW_PER_SOURCE = 100;

export type SourceResult = { source: JobSource; fetched: number; created: number; skipped: number; failed: number; error?: string };

/**
 * The imported company for this employer, created on first sight. Only companies the import created
 * are reused (matched by name) — a real company page on JOBLIO with the same name is never touched.
 */
async function companyFor(job: NormalizedJob, cache: Map<string, string>) {
  const key = job.companyName.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = await db.company.findFirst({
    where: { importSource: { not: null }, name: { equals: job.companyName, mode: "insensitive" } },
    select: { id: true, logoUrl: true },
  });
  let id = existing?.id;
  if (existing && !existing.logoUrl && job.companyLogo) {
    await db.company.update({ where: { id: existing.id }, data: { logoUrl: job.companyLogo } });
  }
  if (!id) {
    const created = await db.company.create({
      data: { slug: await uniqueCompanySlug(job.companyName), name: job.companyName, logoUrl: job.companyLogo, importSource: job.source },
      select: { id: true },
    });
    id = created.id;
  }
  cache.set(key, id);
  return id;
}

async function importSource(source: JobSource, listings: NormalizedJob[], posterId: string, companies: Map<string, string>): Promise<SourceResult> {
  // Drop repeats inside the feed itself, then everything already in the database.
  const unique = [...new Map(listings.map((j) => [j.externalId, j])).values()];
  const stored = await db.job.findMany({
    where: { externalSource: source, externalId: { in: unique.map((j) => j.externalId) } },
    select: { externalId: true },
  });
  const known = new Set(stored.map((s) => s.externalId));
  const fresh = unique.filter((j) => !known.has(j.externalId)).slice(0, MAX_NEW_PER_SOURCE);

  let created = 0;
  let failed = 0;
  for (const j of fresh) {
    try {
      await db.job.create({
        data: {
          companyId: await companyFor(j, companies),
          postedById: posterId,
          status: "DRAFT",
          externalSource: j.source,
          externalId: j.externalId,
          externalUrl: j.externalUrl,
          title: j.title,
          summary: j.summary,
          description: j.description,
          responsibilities: [],
          requirements: [],
          benefits: [],
          workMode: j.workMode,
          employmentType: j.employmentType,
          experienceLevel: j.experienceLevel,
          city: j.city,
          countryCode: j.countryCode,
          salaryMin: j.salaryMin,
          salaryMax: j.salaryMax,
          ...(j.salaryCurrency && { salaryCurrency: j.salaryCurrency }),
          ...(j.salaryPeriod && { salaryPeriod: j.salaryPeriod }),
          closesAt: j.closesAt,
        },
      });
      created++;
    } catch (e) {
      // P2002: another run stored it a moment ago — that's a skip, not a failure.
      if ((e as { code?: string }).code === "P2002") continue;
      failed++;
      console.error(`[job-import] ${source} ${j.externalId}:`, e);
    }
  }
  return { source, fetched: listings.length, created, skipped: unique.length - created - failed, failed };
}

/** Runs every source; one failing feed never stops the others. */
export async function syncAllSources(posterId: string): Promise<SourceResult[]> {
  const companies = new Map<string, string>();
  const results: SourceResult[] = [];
  for (const { source, fetch } of SOURCES) {
    try {
      results.push(await importSource(source, await fetch(), posterId, companies));
    } catch (e) {
      console.error(`[job-import] ${source} failed:`, e);
      results.push({ source, fetched: 0, created: 0, skipped: 0, failed: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
