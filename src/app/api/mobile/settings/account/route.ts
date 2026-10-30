import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { deleteAccount } from "@/server/services/account-deletion";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// DELETE /api/mobile/settings/account  (JSON: { confirm: "DELETE" })  →  { ok: true }
// Deletes the account for good, as Settings → Delete account does on the website: the profile, posts, stories,
// messages, applications and every uploaded file. The app signs out afterwards (its token no longer works).
// 409 DELETE_BLOCKED for a recruiter whose company has no other admin to take over their jobs.
export async function DELETE(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.sensitive.key}:${userId}`, LIMITS.sensitive.max, LIMITS.sensitive.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== "DELETE") return mobileError(400, "CONFIRM_REQUIRED", 'Type DELETE to confirm.');
  const membership = await db.companyMember.findFirst({ where: { userId }, select: { companyId: true } });
  if ((await deleteAccount(userId, membership?.companyId ?? null)) === "blocked") {
    return mobileError(409, "DELETE_BLOCKED", "You created jobs for a company with no other admin. Add another admin to the workspace before deleting your account.");
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
