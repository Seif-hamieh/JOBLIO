import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { globalSearch } from "@/server/services/search";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toCompanyCard, toJobCard } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/search?q=  →  { q, people, companies, jobs, jobTotal, posts }
// The website's search everything: people (the profiles you're allowed to see), companies and jobs in one go —
// 10 people, 8 companies and 8 jobs at most; "see all jobs" continues in the Jobs search.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const viewerId = session.user.id;
  if (!rateLimit(`${LIMITS.search.key}:${viewerId}`, LIMITS.search.max, LIMITS.search.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Too many searches. Try again in a minute.");
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const r = await globalSearch(q, viewerId, { people: 10, companies: 8, jobs: 8, posts: 10 });
  const follows = r.companies.length
    ? await db.companyFollower.findMany({ where: { userId: viewerId, companyId: { in: r.companies.map((c) => c.id) } }, select: { companyId: true } })
    : [];
  const followed = new Set(follows.map((f) => f.companyId));
  const now = Date.now();
  return NextResponse.json(
    {
      q: r.q,
      people: r.people.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        username: p.username,
        headline: p.profile?.headline ?? null,
        city: p.profile?.city ?? null,
        countryCode: p.profile?.countryCode ?? null,
        openToWork: p.profile?.openToWork ?? false,
      })),
      companies: r.companies.map((c) => toCompanyCard(c, followed.has(c.id), now)),
      jobs: r.jobs.map((j) => toJobCard(j, now)),
      jobTotal: r.jobTotal,
      // Matching posts ("#dubai" or a word); older apps ignore them.
      posts: r.posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
