import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { respondToConnection } from "@/server/services/connections";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ accept: z.boolean() });

// POST /api/mobile/network/invitations/:id  { accept }  →  { state: "connected" | "none" }
// Accepts or ignores a request sent to you. The person who asked is told only when you accept.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/network/invitations/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const { user } = session;
  if (!rateLimit(`${LIMITS.write.key}:${user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Say whether to accept.");
  const { id } = await params;
  try {
    await respondToConnection({ id: user.id, name: user.name, username: user.username ?? "" }, id.slice(0, 64), parsed.data.accept);
    return NextResponse.json({ state: parsed.data.accept ? "connected" : "none" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const res = actionErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
