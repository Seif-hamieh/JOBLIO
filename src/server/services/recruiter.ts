import "server-only";
import { db, type Prisma } from "@/server/db";
import { computeMatch, type MatchResult } from "@/lib/matching/engine";
import { candidateMatchSelect, jobMatchSelect, toCandidateFacts, toJobFacts } from "@/server/services/matching";
import { expirePromotions } from "@/server/services/jobs";
import { resolveCountryCode } from "@/lib/geo";
import { EDUCATION_LEVELS, EDUCATION_RANK, SKILL_LEVELS, SKILL_RANK } from "@/lib/constants";
import type { CandidateSearchParams } from "@/lib/validation/search";

export const FREE_RESULTS = 20;
export const PAGE = 20;

/** Filters that require Recruiter Pro. */
export const PRO_FILTERS = ["skillLevel", "languages", "availability", "maxSalary", "education"] as const;

export const candidateCardSelect = {
  id: true,
  name: true,
  image: true,
  username: true,
  profile: {
    select: {
      ...candidateMatchSelect,
      headline: true,
      openToWork: true,
      featuredUntil: true,
      updatedAt: true,
      skills: { orderBy: { position: "asc" }, select: { skillId: true, level: true, skill: { select: { name: true, slug: true } } } },
    },
  },
} satisfies Prisma.UserSelect;

export type CandidateRow = Prisma.UserGetPayload<{ select: typeof candidateCardSelect }>;
export type CandidateResult = CandidateRow & { match?: MatchResult; featured: boolean };

export function buildCandidateWhere(p: CandidateSearchParams, recruiter: { companyId: string; pro: boolean }): Prisma.UserWhereInput {
  const profile: Prisma.ProfileWhereInput[] = [{ searchableByRecruiters: true }];
  if (p.q) {
    for (const term of p.q.split(/\s+/).slice(0, 5)) {
      profile.push({
        OR: [
          { headline: { contains: term, mode: "insensitive" } },
          { user: { name: { contains: term, mode: "insensitive" } } },
          { desiredTitles: { has: term } },
          { experiences: { some: { title: { contains: term, mode: "insensitive" } } } },
        ],
      });
    }
  }
  if (p.location) {
    if (/^remote$/i.test(p.location)) profile.push({ preferredWorkModes: { has: "REMOTE" } });
    else {
      const code = resolveCountryCode(p.location);
      profile.push({ OR: [{ city: { contains: p.location, mode: "insensitive" } }, ...(code ? [{ countryCode: code }] : [])] });
    }
  }
  const minLevel = recruiter.pro ? p.skillLevel : undefined;
  const levels = minLevel ? SKILL_LEVELS.filter((l) => SKILL_RANK[l] >= SKILL_RANK[minLevel]) : undefined;
  for (const slug of p.skills) profile.push({ skills: { some: { skill: { slug }, ...(levels && { level: { in: [...levels] } }) } } });
  if (p.minYears != null) profile.push({ yearsExperience: { gte: p.minYears } });
  if (p.openToWork) profile.push({ openToWork: true });
  if (p.remote) profile.push({ preferredWorkModes: { has: "REMOTE" } });
  if (recruiter.pro) {
    if (p.education) profile.push({ educationLevel: { in: EDUCATION_LEVELS.filter((l) => EDUCATION_RANK[l] >= EDUCATION_RANK[p.education!]) } });
    for (const code of p.languages) profile.push({ languages: { some: { languageCode: code } } });
    if (p.availability.length) profile.push({ availability: { in: p.availability } });
    if (p.maxSalary != null) profile.push({ OR: [{ desiredSalaryMin: null }, { desiredSalaryMin: { lte: p.maxSalary } }] });
  }
  return {
    profile: { AND: profile },
    companyMemberships: { none: { companyId: recruiter.companyId } },
  };
}

export async function searchCandidates(p: CandidateSearchParams, recruiter: { id: string; companyId: string; pro: boolean }) {
  await expirePromotions();
  const where: Prisma.UserWhereInput = {
    AND: [
      buildCandidateWhere(p, recruiter),
      { id: { not: recruiter.id } },
      // Hide anyone who blocked this recruiter, or whom the recruiter blocked.
      { blocksMade: { none: { blockedId: recruiter.id } } },
      { blocksReceived: { none: { blockerId: recruiter.id } } },
    ],
  };
  const job = p.job
    ? await db.job.findFirst({ where: { id: p.job, companyId: recruiter.companyId }, select: { id: true, title: true, ...jobMatchSelect } })
    : null;
  const now = new Date();

  // Boosted (Career Boost) candidates get a clearly-labelled featured strip.
  const featured =
    p.page === 1
      ? await db.user.findMany({ where: { AND: [where, { profile: { featuredUntil: { gt: now } } }] }, select: candidateCardSelect, take: 3, orderBy: { profile: { featuredUntil: "desc" } } })
      : [];

  const limit = recruiter.pro ? PAGE : FREE_RESULTS;
  const page = recruiter.pro ? p.page : 1;
  let rows: CandidateRow[];
  let total = await db.user.count({ where });

  if (job && p.sort === "match") {
    const pool = await db.user.findMany({ where, select: candidateCardSelect, take: 400, orderBy: { profile: { updatedAt: "desc" } } });
    const jf = toJobFacts(job);
    const scored = pool.map((u) => ({ u, score: u.profile ? computeMatch(toCandidateFacts(u.profile), jf, "recruiter").score : 0 }));
    scored.sort((a, b) => b.score - a.score);
    rows = scored.slice((page - 1) * limit, page * limit).map((s) => s.u);
    total = Math.min(total, pool.length);
  } else {
    rows = await db.user.findMany({
      where,
      select: candidateCardSelect,
      orderBy: p.sort === "experience" ? { profile: { yearsExperience: "desc" } } : { profile: { updatedAt: "desc" } },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  const annotate = (u: CandidateRow): CandidateResult => ({
    ...u,
    match: job && u.profile ? computeMatch(toCandidateFacts(u.profile), toJobFacts(job), "recruiter") : undefined,
    featured: !!u.profile?.featuredUntil && u.profile.featuredUntil > now,
  });
  const featuredIds = new Set(featured.map((f) => f.id));
  return {
    job: job ? { id: job.id, title: job.title } : null,
    featured: featured.map(annotate),
    results: rows.filter((r) => !featuredIds.has(r.id)).map(annotate),
    total,
    pageCount: recruiter.pro ? Math.max(1, Math.ceil(total / PAGE)) : 1,
    limited: !recruiter.pro && total > FREE_RESULTS,
  };
}

export async function recruiterDashboard(companyId: string) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [jobs, byStage, newApplicants, upcomingInterviews, recent] = await Promise.all([
    db.job.findMany({
      where: { companyId },
      orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        workMode: true,
        city: true,
        publishedAt: true,
        viewCount: true,
        applicationCount: true,
        featuredUntil: true,
        sponsoredUntil: true,
        _count: { select: { applications: { where: { status: "APPLIED" } } } },
      },
    }),
    db.application.groupBy({ by: ["stage"], where: { job: { companyId }, status: { notIn: ["REJECTED", "WITHDRAWN"] } }, _count: true }),
    db.application.count({ where: { job: { companyId }, createdAt: { gte: weekAgo } } }),
    db.interview.findMany({
      where: { application: { job: { companyId } }, status: "SCHEDULED", startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, startsAt: true, type: true, candidateResponse: true, application: { select: { applicant: { select: { name: true, image: true, username: true } }, job: { select: { title: true } } } } },
    }),
    db.application.findMany({
      where: { job: { companyId }, status: { in: ["APPLIED", "VIEWED"] } },
      orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, matchScore: true, createdAt: true, jobId: true, job: { select: { title: true } }, applicant: { select: { name: true, image: true, username: true, profile: { select: { headline: true } } } } },
    }),
  ]);
  return { jobs, byStage: Object.fromEntries(byStage.map((s) => [s.stage, s._count])) as Record<string, number>, newApplicants, upcomingInterviews, recent };
}

export async function getPipeline(jobId: string, companyId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: { id: true, title: true, status: true, workMode: true, city: true, countryCode: true, applicationCount: true },
  });
  if (!job) return null;
  const apps = await db.application.findMany({
    where: { jobId, status: { not: "WITHDRAWN" } },
    orderBy: [{ stagePosition: "asc" }],
    select: {
      id: true,
      status: true,
      stage: true,
      stagePosition: true,
      matchScore: true,
      rating: true,
      createdAt: true,
      viewedAt: true,
      applicant: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true, city: true, countryCode: true, yearsExperience: true, availability: true } } } },
      _count: { select: { interviews: true, notes: true } },
    },
  });
  return { job, apps };
}

export type PipelineCard = NonNullable<Awaited<ReturnType<typeof getPipeline>>>["apps"][number];

export async function getApplicationDetail(applicationId: string, companyId: string) {
  return db.application.findFirst({
    where: { id: applicationId, job: { companyId } },
    select: {
      id: true,
      status: true,
      stage: true,
      matchScore: true,
      matchSnapshot: true,
      coverLetter: true,
      resumeUrl: true,
      rating: true,
      createdAt: true,
      job: { select: { id: true, title: true } },
      applicant: {
        select: {
          id: true,
          name: true,
          image: true,
          username: true,
          email: false,
          profile: {
            select: {
              headline: true,
              city: true,
              countryCode: true,
              yearsExperience: true,
              availability: true,
              openToWork: true,
              skills: { orderBy: { position: "asc" }, take: 10, select: { level: true, skill: { select: { name: true } } } },
              experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }], take: 3, select: { title: true, companyName: true, isCurrent: true, startDate: true, endDate: true } },
            },
          },
        },
      },
      events: { orderBy: { createdAt: "desc" }, select: { id: true, toStatus: true, toStage: true, note: true, createdAt: true, actor: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, select: { id: true, body: true, createdAt: true, author: { select: { name: true, image: true } } } },
      interviews: { orderBy: { startsAt: "desc" }, select: { id: true, startsAt: true, type: true, status: true, candidateResponse: true } },
    },
  });
}

export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;
