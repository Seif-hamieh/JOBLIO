import { NextResponse } from "next/server";
import { computeMatch } from "@/lib/matching/engine";
import { db } from "@/server/db";
import { getJob } from "@/server/services/jobs";
import { getCandidateFacts, toJobFacts } from "@/server/services/matching";
import { cacheHeaders, getMobileSession, mobileError } from "@/server/mobile/auth";
import { toJobDetail } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/jobs/:id  →  { job }
// Only published, open jobs (closed ones answer 410 Gone, like the website). With a bearer token the job also
// carries the member's match score and whether they saved / applied.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/jobs/[id]">) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job || !job.publishedAt) return mobileError(404, "NOT_FOUND", "This job doesn't exist.");
  if (job.status !== "OPEN") return mobileError(410, "GONE", "This job is no longer open.");

  const session = await getMobileSession(req);
  let viewer = null;
  if (session) {
    const userId = session.user.id;
    const [facts, saved, application] = await Promise.all([
      getCandidateFacts(userId),
      db.savedJob.findUnique({ where: { userId_jobId: { userId, jobId: id } }, select: { jobId: true } }),
      db.application.findUnique({ where: { jobId_applicantId: { jobId: id, applicantId: userId } }, select: { id: true } }),
    ]);
    viewer = { match: facts ? computeMatch(facts, toJobFacts(job)) : null, saved: !!saved, applied: !!application };
  }
  return NextResponse.json({ job: toJobDetail(job, viewer) }, { headers: cacheHeaders(!!session) });
}
