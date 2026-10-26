import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { revokeSession } from "@/server/services/settings";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// DELETE /api/mobile/settings/sessions/:id  →  204
// Signs out one of your other devices. Only your own sessions; this phone's own session can't be ended here (that's
// Sign out). 404 if it's already gone.
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/settings/sessions/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { id } = await params;
  if (id === session.session.id) return mobileError(400, "CURRENT_SESSION", "Use Sign out to sign out of this phone.");
  if (!(await revokeSession(session.user.id, id.slice(0, 64), session.session.id))) return mobileError(404, "NOT_FOUND", "That device is already signed out.");
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
