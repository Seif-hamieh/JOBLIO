import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { markStoryViewed } from "@/server/services/stories";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// POST /api/mobile/stories/:id/view  →  { ok: true }
// The app calls it when a story is shown. Counted once per member and story (calling it again is harmless); your
// own stories aren't counted. 404 when the story expired, was removed, or isn't from someone in your network.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/stories/[id]/view">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.like.key}:story-view:${session.user.id}`, LIMITS.like.max, LIMITS.like.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  }
  const { id } = await params;
  if (!(await markStoryViewed(session.user.id, id.slice(0, 40)))) return mobileError(404, "NOT_FOUND", "This story is no longer available.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
