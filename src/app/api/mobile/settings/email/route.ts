import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { bearerToken, forwardToAuth, getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ newEmail: z.string().trim().toLowerCase().email().max(254) });

// POST /api/mobile/settings/email  { newEmail }  →  { ok: true }
// Sends a confirmation link to the NEW address (Better Auth's change-email). The account's email only changes when
// that link is opened, so an account can't be moved to an address its owner doesn't control. The answer is the same
// whether or not the address is already used by another account (it can't be used to find out who is a member).
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  const token = bearerToken(req);
  if (!session || !token) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.sensitive.key}:${session.user.id}`, LIMITS.sensitive.max, LIMITS.sensitive.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a few minutes.");
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_EMAIL", "Enter a valid email address.");
  if (parsed.data.newEmail === session.user.email.toLowerCase()) return mobileError(400, "SAME_EMAIL", "That's already your email.");

  const res = await forwardToAuth(req, "/change-email", { newEmail: parsed.data.newEmail, callbackURL: "/settings" }, token);
  if (!res.ok) {
    if (res.status === 429) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a few minutes.");
    return mobileError(res.status >= 500 ? 502 : 400, "CHANGE_FAILED", "Couldn't start the email change. Try again.");
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
