import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getCandidateFacts, jobMatchSelect, toJobFacts } from "@/server/services/matching";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { computeMatch } from "@/lib/matching/engine";

export const dynamic = "force-dynamic";

// Applications that are over: hired, not selected, or withdrawn.
const CLOSED = ["REJECTED", "WITHDRAWN", "HIRED"] as const;

// GET /api/mobile/applications?view=active|archived  →  { applications, counts: { active, archived } }
// The website's My Applications: each job you applied to with where it stands, its history and the next interview.
// The match score is the live, job-seeker one (as on the job page).
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const archived = new URL(req.url).searchParams.get("view") === "archived";
  const [apps, facts, counts] = await Promise.all([
    db.application.findMany({
      where: { applicantId: userId, status: archived ? { in: [...CLOSED] } : { notIn: [...CLOSED] } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        matchScore: true,
        createdAt: true,
        updatedAt: true,
        job: { select: { ...jobMatchSelect, id: true, title: true, workMode: true, city: true, status: true, company: { select: { name: true, logoUrl: true, brandColor: true, slug: true } } } },
        events: { orderBy: { createdAt: "asc" }, select: { id: true, toStatus: true, createdAt: true } },
        interviews: { where: { status: "SCHEDULED", startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, type: true } },
      },
    }),
    getCandidateFacts(userId),
    db.application.groupBy({ by: ["status"], where: { applicantId: userId }, _count: true }),
  ]);
  const isClosed = (s: string) => (CLOSED as readonly string[]).includes(s);
  return NextResponse.json(
    {
      applications: apps.map((a) => ({
        id: a.id,
        status: a.status,
        appliedAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        matchScore: facts ? computeMatch(facts, toJobFacts(a.job)).score : a.matchScore,
        job: {
          id: a.job.id,
          title: a.job.title,
          workMode: a.job.workMode,
          city: a.job.city,
          open: a.job.status === "OPEN",
          company: { name: a.job.company.name, slug: a.job.company.slug, logoUrl: a.job.company.logoUrl, brandColor: a.job.company.brandColor },
        },
        history: a.events.filter((e) => e.toStatus).map((e) => ({ status: e.toStatus, at: e.createdAt.toISOString() })),
        nextInterview: a.interviews[0] ? { startsAt: a.interviews[0].startsAt.toISOString(), type: a.interviews[0].type } : null,
      })),
      counts: {
        active: counts.filter((c) => !isClosed(c.status)).reduce((s, c) => s + c._count, 0),
        archived: counts.filter((c) => isClosed(c.status)).reduce((s, c) => s + c._count, 0),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
