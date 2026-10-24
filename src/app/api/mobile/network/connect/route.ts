import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { requestConnection } from "@/server/services/connections";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ userId: z.string().min(1).max(64), note: z.string().trim().max(300).optional() });

// POST /api/mobile/network/connect  { userId, note? }  →  { state: "pending-out" | "connected" }
// Sends a connection request, like the website's Connect button. If they had already asked you, you're connected.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const { user } = session;
  const limit = rateLimit(`${LIMITS.connect.key}:${user.id}`, LIMITS.connect.max, LIMITS.connect.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many requests. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Unknown member, or the note is too long (300 characters).");
  try {
    const result = await requestConnection({ id: user.id, name: user.name, username: user.username ?? "" }, parsed.data.userId, parsed.data.note || null);
    return NextResponse.json({ state: result === "connected" ? "connected" : "pending-out" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const res = actionErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
