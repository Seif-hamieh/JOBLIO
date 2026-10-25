import { NextResponse } from "next/server";
import { featuredJobs } from "@/server/services/jobs";
import { cacheHeaders, getMobileSession } from "@/server/mobile/auth";
import { toJobCard } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/jobs/featured  →  { jobs }
// Jobs companies chose to feature or sponsor, as on the website's Featured jobs page. With a bearer token each job
// carries your match score.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  const jobs = await featuredJobs(session?.user.id ?? null, 40);
  const now = Date.now();
  return NextResponse.json({ jobs: jobs.map((j) => toJobCard(j, now)) }, { headers: cacheHeaders(!!session) });
}
