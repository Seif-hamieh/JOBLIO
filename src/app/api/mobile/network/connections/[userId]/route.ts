import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { removeConnection } from "@/server/services/connections";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// DELETE /api/mobile/network/connections/:userId  →  { state: "none" }
// Withdraws a request you sent, or removes a connection.
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/network/connections/[userId]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { userId } = await params;
  await removeConnection(session.user.id, userId.slice(0, 64));
  return NextResponse.json({ state: "none" }, { headers: { "Cache-Control": "no-store" } });
}
