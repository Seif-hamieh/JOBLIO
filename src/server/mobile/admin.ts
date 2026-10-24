import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";
import { resolveMessage } from "@/i18n/message";
import { createT } from "@/i18n/translate";

// The mobile admin panel (/api/mobile/admin/*). Like the website, the admin role is read from the database on
// every request — a hidden button in the app is not a security boundary. Non-admins get 404 (the website's admin
// pages answer "not found" too, so their existence isn't confirmed).

export const ADMIN_PAGE = 30;

/** The signed-in admin's id, or a ready error response. */
export async function getMobileAdmin(req: Request): Promise<{ adminId: string } | { error: NextResponse }> {
  const session = await getMobileSession(req);
  if (!session) return { error: mobileError(401, "UNAUTHORIZED", "Sign in first.") };
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { platformRole: true } });
  if (user?.platformRole !== "ADMIN") return { error: mobileError(404, "NOT_FOUND", "Not found.") };
  return { adminId: session.user.id };
}

/**
 * Runs an admin change with the website's rate limit and turns its result into { message } (English), or the
 * reason it was refused into an error response.
 */
export async function adminChange(req: Request, change: (adminId: string) => Promise<string>) {
  const a = await getMobileAdmin(req);
  if ("error" in a) return a.error;
  if (!rateLimit(`${LIMITS.write.key}:${a.adminId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  try {
    const message = await change(a.adminId);
    return NextResponse.json({ message: resolveMessage(createT("en"), message) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}

/** ?page= (1-based, at most 1000) and ?q= (trimmed, at most 100 characters) from a list request. */
export function listParams(req: Request) {
  const sp = new URL(req.url).searchParams;
  const page = Math.min(1000, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  return { sp, page, q: sp.get("q")?.trim().slice(0, 100) || undefined, skip: (page - 1) * ADMIN_PAGE };
}

export const noStore = { "Cache-Control": "private, no-store" };
