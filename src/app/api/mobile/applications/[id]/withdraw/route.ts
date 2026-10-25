import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { withdrawApplication } from "@/server/services/applications";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// POST /api/mobile/applications/:id/withdraw  →  { status: "WITHDRAWN" }
// Withdraws one of your applications (not once you're hired or it was declined), as on the website.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/applications/[id]/withdraw">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { id } = await params;
  try {
    await withdrawApplication(session.user.id, id.slice(0, 40));
    return NextResponse.json({ status: "WITHDRAWN" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
