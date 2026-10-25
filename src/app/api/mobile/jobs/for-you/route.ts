import { NextResponse } from "next/server";
import { jobsForYou } from "@/server/services/jobs";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toJobCard } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/jobs/for-you  →  { jobs }
// The website's Jobs for you: open jobs scored by the matching engine for your skills, experience and preferences
// (40% match or more), best first, without the ones you already applied to. Empty until your profile has skills.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const jobs = await jobsForYou(session.user.id, { limit: 50 });
  const now = Date.now();
  return NextResponse.json({ jobs: jobs.map((j) => toJobCard(j, now)) }, { headers: { "Cache-Control": "private, no-store" } });
}
