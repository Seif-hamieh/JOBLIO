import "server-only";
import { startOfTodayUtc } from "@/lib/validation/job";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db, type Prisma } from "@/server/db";
import { resolveCountryCode } from "@/lib/geo";
import type { JobSearchParams } from "@/lib/validation/search";
import type { MatchResult } from "@/lib/matching/engine";
import type { EmploymentType, ExperienceLevel, WorkMode } from "@/lib/constants";
import { getCandidateFacts, jobMatchSelect, scoreJobs } from "@/server/services/matching";

export const PAGE_SIZE = 20;
// How many of the newest open jobs are scored in memory when ranking by match (/jobs, /home, For You).
const MATCH_POOL_SIZE = 300;

export const jobCardSelect = {
  id: true,
  title: true,
  summary: true,
  experienceLevel: true,
  publishedAt: true,
  featuredUntil: true,
  sponsoredUntil: true,
  urgentUntil: true,
  applicationCount: true,
  status: true,
  company: { select: { id: true, slug: true, name: true, logoUrl: true, verified: true, brandColor: true } },
  ...jobMatchSelect,
} satisfies Prisma.JobSelect;

export type JobCardData = Prisma.JobGetPayload<{ select: typeof jobCardSelect }>;
export type JobCardWithMatch = JobCardData & { match?: MatchResult; saved?: boolean; applied?: boolean };

// ── Promotion expiry ────────────────────────────────────────────────────────
// Promotion windows are denormalised onto rows so ranking is one indexed sort.
// Expired windows are cleared lazily (at most once a minute per process), so
// no cron job is needed.
let lastExpiry = 0;
export async function expirePromotions() {
  const now = Date.now();
  if (now - lastExpiry < 60_000) return;
  lastExpiry = now;
  const at = new Date(now);
  await Promise.all([
    // Jobs past their closing day close themselves.
    db.job.updateMany({ where: { status: "OPEN", closesAt: { lt: new Date(startOfTodayUtc(at)) } }, data: { status: "CLOSED" } }),
    db.job.updateMany({ where: { featuredUntil: { lt: at } }, data: { featuredUntil: null } }),
    db.job.updateMany({ where: { sponsoredUntil: { lt: at } }, data: { sponsoredUntil: null } }),
    db.profile.updateMany({ where: { featuredUntil: { lt: at } }, data: { featuredUntil: null } }),
    db.company.updateMany({ where: { premiumUntil: { lt: at } }, data: { premiumUntil: null } }),
  ]);
}

function containsInsensitive(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export function buildJobWhere(p: JobSearchParams): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [];
  if (p.q) {
    for (const term of p.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      and.push({
        OR: [
          { title: containsInsensitive(term) },
          { summary: containsInsensitive(term) },
          { company: { name: containsInsensitive(term) } },
          { skills: { some: { skill: { name: containsInsensitive(term) } } } },
        ],
      });
    }
  }
  if (p.location) {
    const loc = p.location.trim();
    if (/^remote$/i.test(loc)) {
      and.push({ workMode: "REMOTE" });
    } else {
      const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
      const or: Prisma.JobWhereInput[] = [];
      for (const part of parts) {
        const code = resolveCountryCode(part);
        if (code) or.push({ countryCode: code });
        or.push({ city: containsInsensitive(part) });
      }
      and.push({ OR: or });
    }
  }
  if (p.mode.length) and.push({ workMode: { in: p.mode } });
  if (p.type.length) and.push({ employmentType: { in: p.type } });
  if (p.level.length) and.push({ experienceLevel: { in: p.level } });
  if (p.salary) {
    // Normalise the yearly minimum to each posting's pay period.
    and.push({
      OR: [
        { salaryPeriod: "YEAR", salaryMax: { gte: p.salary } },
        { salaryPeriod: "MONTH", salaryMax: { gte: Math.round(p.salary / 12) } },
        { salaryPeriod: "HOUR", salaryMax: { gte: Math.round(p.salary / 2080) } },
      ],
    });
  }
  if (p.industry) and.push({ industry: { slug: p.industry } });
  for (const slug of p.skills) and.push({ skills: { some: { skill: { slug } } } });
  if (p.company) and.push({ company: { slug: p.company } });
  if (p.posted) and.push({ publishedAt: { gte: new Date(Date.now() - Number(p.posted) * 86_400_000) } });
  return { status: "OPEN", AND: and };
}

const ORDER: Record<Exclude<JobSearchParams["sort"], "match">, Prisma.JobOrderByWithRelationInput[]> = {
  relevant: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
  newest: [{ publishedAt: "desc" }],
  salary: [{ salaryMax: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
};

async function annotateForViewer(jobs: JobCardData[], viewerId: string | null, matches?: Map<string, MatchResult>) {
  if (!viewerId || jobs.length === 0) return jobs as JobCardWithMatch[];
  const ids = jobs.map((j) => j.id);
  const [saved, applied, facts] = await Promise.all([
    db.savedJob.findMany({ where: { userId: viewerId, jobId: { in: ids } }, select: { jobId: true } }),
    db.application.findMany({ where: { applicantId: viewerId, jobId: { in: ids } }, select: { jobId: true } }),
    matches ? Promise.resolve(null) : getCandidateFacts(viewerId),
  ]);
  const scored = matches ?? scoreJobs(facts, jobs);
  const savedSet = new Set(saved.map((s) => s.jobId));
  const appliedSet = new Set(applied.map((a) => a.jobId));
  return jobs.map((j) => ({ ...j, match: scored.get(j.id), saved: savedSet.has(j.id), applied: appliedSet.has(j.id) }));
}

export async function searchJobs(p: JobSearchParams, viewerId: string | null) {
  await expirePromotions();
  const where = buildJobWhere(p);
  const now = new Date();

  // Sponsored placements: up to two clearly-labelled slots on page one that
  // still have to satisfy the user's filters.
  const sponsored =
    p.page === 1
      ? await db.job.findMany({
          where: { AND: [where, { sponsoredUntil: { gt: now } }] },
          select: jobCardSelect,
          orderBy: { sponsoredUntil: "desc" },
          take: 2,
        })
      : [];
  const sponsoredIds = sponsored.map((j) => j.id);
  const organicWhere: Prisma.JobWhereInput = sponsoredIds.length ? { AND: [where, { id: { notIn: sponsoredIds } }] } : where;

  let jobs: JobCardData[];
  let total: number;
  let matches: Map<string, MatchResult> | undefined;

  if (p.sort === "match" && viewerId) {
    // Rank a bounded candidate set by score in memory (see docs/ARCHITECTURE.md).
    const [pool, facts] = await Promise.all([
      db.job.findMany({ where: organicWhere, select: jobCardSelect, orderBy: { publishedAt: "desc" }, take: MATCH_POOL_SIZE }),
      getCandidateFacts(viewerId),
    ]);
    matches = scoreJobs(facts, pool);
    pool.sort((a, b) => (matches!.get(b.id)?.score ?? 0) - (matches!.get(a.id)?.score ?? 0));
    total = pool.length;
    jobs = pool.slice((p.page - 1) * PAGE_SIZE, p.page * PAGE_SIZE);
  } else {
    const order = ORDER[p.sort === "match" ? "relevant" : p.sort];
    [jobs, total] = await Promise.all([
      db.job.findMany({ where: organicWhere, select: jobCardSelect, orderBy: order, skip: (p.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      db.job.count({ where: organicWhere }),
    ]);
  }

  const [annotated, annotatedSponsored] = await Promise.all([
    annotateForViewer(jobs, viewerId, matches),
    annotateForViewer(sponsored, viewerId),
  ]);
  return { jobs: annotated, sponsored: annotatedSponsored, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/**
 * "Jobs For You": a bounded pre-filter in SQL (shares a skill, or matches the
 * user's location / remote preference), then transparent scoring in memory.
 */
export async function jobsForYou(userId: string, opts: { limit?: number; minScore?: number } = {}) {
  const [, facts] = await Promise.all([expirePromotions(), getCandidateFacts(userId)]);
  if (!facts) return [];

  // The same candidate pool as /jobs sorted by match (searchJobs: the newest open jobs, scored by the
  // same engine), so a job shown at 92% there is never missing here. The only difference: jobs the
  // member already applied to are left out of recommendations.
  const pool = await db.job.findMany({
    where: { status: "OPEN", applications: { none: { applicantId: userId } } },
    select: jobCardSelect,
    orderBy: { publishedAt: "desc" },
    take: MATCH_POOL_SIZE,
  });
  const matches = scoreJobs(facts, pool);
  const ranked = pool
    .map((j) => ({ job: j, score: matches.get(j.id)?.score ?? 0 }))
    .filter((r) => r.score >= (opts.minScore ?? 40))
    .sort((a, b) => b.score - a.score || (b.job.publishedAt?.getTime() ?? 0) - (a.job.publishedAt?.getTime() ?? 0))
    .slice(0, opts.limit ?? 50)
    .map((r) => r.job);
  return annotateForViewer(ranked, userId, matches);
}

export const jobDetailSelect = {
  ...jobCardSelect,
  description: true,
  // Imported listings: shown with "Source: …" and an Apply button to the original site.
  externalSource: true,
  externalUrl: true,
  responsibilities: true,
  requirements: true,
  benefits: true,
  salaryPeriod: true,
  closesAt: true,
  createdAt: true,
  viewCount: true,
  postedById: true,
  postedBy: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } },
  company: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      verified: true,
      brandColor: true,
      tagline: true,
      about: true,
      size: true,
      city: true,
      countryCode: true,
      website: true,
      followerCount: true,
      industry: { select: { name: true } },
      _count: { select: { jobs: { where: { status: "OPEN" } } } },
    },
  },
} satisfies Prisma.JobSelect;

export type JobDetail = Prisma.JobGetPayload<{ select: typeof jobDetailSelect }>;

export async function getJob(id: string) {
  if (!id || id === "undefined") return null;
  return db.job.findUnique({ where: { id }, select: jobDetailSelect });
}

const VIEW_WINDOW_MS = 24 * 3600 * 1000;

/** A stable, non-reversible key for a signed-out visitor (network address + browser). */
export async function anonymousViewerKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "";
  return "a:" + createHash("sha256").update(`${ip}|${h.get("user-agent") ?? ""}`).digest("hex").slice(0, 40);
}

/**
 * Counts a job view at most once per viewer per 24 hours. `viewerKey` is the
 * user id, or a hash of the visitor's network address and browser.
 */
export async function recordJobView(jobId: string, viewerKey: string) {
  const now = new Date();
  // Claim this viewer's slot only if they have no view in the last 24 hours (one atomic statement).
  const claimed = await db.$executeRaw`
    INSERT INTO job_views ("jobId", "viewerKey", "viewedAt") VALUES (${jobId}, ${viewerKey}, ${now})
    ON CONFLICT ("jobId", "viewerKey") DO UPDATE SET "viewedAt" = EXCLUDED."viewedAt"
    WHERE job_views."viewedAt" < ${new Date(now.getTime() - VIEW_WINDOW_MS)}`;
  if (!claimed) return;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  await db.$transaction([
    db.job.update({ where: { id: jobId }, data: { viewCount: { increment: 1 } } }),
    db.jobDailyStat.upsert({
      where: { jobId_date: { jobId, date: today } },
      create: { jobId, date: today, views: 1 },
      update: { views: { increment: 1 } },
    }),
  ]);
}

/**
 * Up to 3 open jobs like this one: same company, or the same work mode + employment type +
 * experience level, or sharing a skill. Currently featured jobs first, then the newest.
 */
export async function similarJobs(
  job: { id: string; skills: { skillId: string }[]; company: { id: string }; workMode: WorkMode; employmentType: EmploymentType; experienceLevel: ExperienceLevel },
  viewerId: string | null,
) {
  const candidates = await db.job.findMany({
    where: {
      status: "OPEN",
      id: { not: job.id },
      OR: [
        { companyId: job.company.id },
        { workMode: job.workMode, employmentType: job.employmentType, experienceLevel: job.experienceLevel },
        ...(job.skills.length ? [{ skills: { some: { skillId: { in: job.skills.map((s) => s.skillId) } } } }] : []),
      ],
    },
    select: jobCardSelect,
    orderBy: { publishedAt: "desc" },
    take: 12,
  });
  // Featured first — only while the promotion is active (an expired featuredUntil doesn't count).
  const now = Date.now();
  const featured = (j: (typeof candidates)[number]) => (j.featuredUntil && j.featuredUntil.getTime() > now ? 1 : 0);
  const jobs = [...candidates].sort((a, b) => featured(b) - featured(a)).slice(0, 3);
  return annotateForViewer(jobs, viewerId);
}

export async function featuredJobs(viewerId: string | null, take = 24) {
  await expirePromotions();
  const now = new Date();
  const jobs = await db.job.findMany({
    where: { status: "OPEN", OR: [{ featuredUntil: { gt: now } }, { sponsoredUntil: { gt: now } }] },
    select: jobCardSelect,
    orderBy: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
    take,
  });
  return annotateForViewer(jobs, viewerId);
}
