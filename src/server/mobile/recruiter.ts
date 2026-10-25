import "server-only";
import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { db } from "@/server/db";
import { actionErrorResponse, getMobileRecruiter, mobileError } from "@/server/mobile/auth";
import { resolveMessage } from "@/i18n/message";
import { createT } from "@/i18n/translate";

// Shared by the mobile recruiter endpoints (/api/mobile/recruiter/*).

type Recruiter = { userId: string; companyId: string };

/**
 * Runs a recruiter change with the website's rate limit and turns its message key into { message } (English), or
 * the reason it was refused into an error response.
 */
export async function recruiterChange(req: Request, change: (r: Recruiter) => Promise<string | void>, extra: Record<string, unknown> = {}) {
  const r = await getMobileRecruiter(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  try {
    const key = await change(r);
    return NextResponse.json({ ...extra, message: key ? resolveMessage(createT("en"), key) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}

/** Whether the recruiter may edit the company page (owners and admins, as on the website). */
export async function canManage(r: Recruiter) {
  const m = await db.companyMember.findFirst({ where: { userId: r.userId, companyId: r.companyId }, select: { role: true } });
  return m?.role === "OWNER" || m?.role === "ADMIN";
}

/** A 400 INVALID_FIELDS answer naming the rejected fields (for bodies checked with a website schema). */
export function invalidFields(issues: { path: PropertyKey[] }[], message = "Check the highlighted fields.") {
  const fields = [...new Set(issues.map((i) => String(i.path[0] ?? "body")))];
  return NextResponse.json({ error: { code: "INVALID_FIELDS", message, fields } }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
