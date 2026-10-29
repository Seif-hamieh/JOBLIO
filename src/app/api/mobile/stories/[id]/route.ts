import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { deleteOwnStory } from "@/server/services/stories";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// DELETE /api/mobile/stories/:id  →  { ok: true }
// Deletes one of your own stories before its 24 hours are up, with its photo or video (removed from storage too).
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/stories/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { id } = await params;
  if (!(await deleteOwnStory(session.user.id, id.slice(0, 40)))) return mobileError(404, "NOT_FOUND", "This story doesn't exist or isn't yours.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
