import { NextResponse } from "next/server";
import { z } from "zod";
import { assessPassword } from "@/lib/password";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { bearerToken, forwardToAuth, getMobileSession, mobileError, tokenFromSetCookie } from "@/server/mobile/auth";
import { createT } from "@/i18n/translate";

export const dynamic = "force-dynamic";

const body = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ["newPassword"] });

const en = createT("en");

// POST /api/mobile/settings/password  { currentPassword, newPassword }  →  { token }
// Changes the password through Better Auth (the website's rules: at least 10 characters, not common, repeated,
// sequential or personal) and signs out every device. This phone stays signed in: the new session's token is
// returned and the app keeps using it instead of the old one.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  const token = bearerToken(req);
  if (!session || !token) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.sensitive.key}:${userId}`, LIMITS.sensitive.max, LIMITS.sensitive.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a few minutes.");
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const same = parsed.error.issues.some((i) => i.path[0] === "newPassword" && i.code === "custom");
    return mobileError(400, "INVALID_FIELDS", same ? "Choose a password different from your current one." : `Use at least 10 characters for your new password.`);
  }
  if (!(await db.account.findFirst({ where: { userId, providerId: "credential" }, select: { id: true } }))) {
    return mobileError(400, "NO_PASSWORD", "You sign in with Google, so there's no JOBLIO password to change.");
  }
  // Same check as the website (it also rejects passwords made from your name or email).
  const weak = assessPassword(parsed.data.newPassword, [session.user.email, session.user.name]).problem;
  if (weak) return mobileError(400, "WEAK_PASSWORD", en(`auth.weak.${weak}`));

  const res = await forwardToAuth(req, "/change-password", { ...parsed.data, revokeOtherSessions: true }, token);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    if (res.status === 429) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a few minutes.");
    if (err.code === "INVALID_PASSWORD") return mobileError(400, "WRONG_PASSWORD", "Your current password isn't right.");
    if (err.code?.startsWith("WEAK_PASSWORD")) return mobileError(400, "WEAK_PASSWORD", en("auth.weak.common"));
    return mobileError(res.status >= 500 ? 502 : res.status, err.code ?? "CHANGE_FAILED", "Couldn't change your password. Try again.");
  }
  const newToken = await tokenFromSetCookie(res);
  if (!newToken) return mobileError(502, "NO_SESSION", "Your password changed, but please sign in again.");
  return NextResponse.json({ token: newToken }, { headers: { "Cache-Control": "no-store" } });
}
