import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { listSessions, revokeOtherSessions } from "@/server/services/settings";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

/** A short, readable name for a signed-in device from its browser / app string. */
function deviceName(ua: string | null) {
  if (!ua) return "Unknown device";
  // The app's requests come from Android's HTTP stack or iOS's, not a browser.
  if (/okhttp|Expo|ReactNative/i.test(ua)) return "JOBLIO app";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  return [browser, os].filter(Boolean).join(" · ") || "Browser";
}

// GET /api/mobile/settings/sessions  →  { sessions: [{ id, current, device, signedInAt, lastActiveAt }] }
// The devices signed in to this account (this phone first), newest activity first.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const currentId = session.session.id;
  const sessions = (await listSessions(session.user.id))
    .map((s) => ({ id: s.id, current: s.id === currentId, device: deviceName(s.userAgent), signedInAt: s.createdAt, lastActiveAt: s.updatedAt }))
    .sort((a, b) => Number(b.current) - Number(a.current));
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
}

// DELETE /api/mobile/settings/sessions  →  { revoked }
// "Sign out of all other devices": every session except this phone's ends at once (the website included).
export async function DELETE(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const revoked = await revokeOtherSessions(session.user.id, session.session.id);
  return NextResponse.json({ revoked }, { headers: { "Cache-Control": "no-store" } });
}
