import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { jobCardSelect } from "@/server/services/jobs";
import { getCandidateFacts, scoreJobs } from "@/server/services/matching";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toJobCard } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/saved  (Authorization: Bearer <token>)  →  { jobs }
// The member's bookmarked jobs, newest bookmark first, with their match score; jobs that have since closed
// stay in the list with status CLOSED / PAUSED so the member knows why they can't apply.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const saved = await db.savedJob.findMany({
    where: { userId, job: { publishedAt: { not: null } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { job: { select: jobCardSelect } },
  });
  const jobs = saved.map((s) => s.job);
  const [facts, applied] = await Promise.all([
    getCandidateFacts(userId),
    db.application.findMany({ where: { applicantId: userId, jobId: { in: jobs.map((j) => j.id) }, status: { not: "WITHDRAWN" } }, select: { jobId: true } }),
  ]);
  const matches = scoreJobs(facts, jobs);
  const appliedIds = new Set(applied.map((a) => a.jobId));
  const now = Date.now();
  return NextResponse.json(
    { jobs: jobs.map((j) => ({ ...toJobCard({ ...j, match: matches.get(j.id), saved: true, applied: appliedIds.has(j.id) }, now), status: j.status })) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
