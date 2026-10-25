import { NextResponse } from "next/server";
import { z } from "zod";
import { forwardToAuth, mobileError } from "@/server/mobile/auth";
import { createT } from "@/i18n/translate";
import { USER_INTENTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
  intent: z.enum(USER_INTENTS).catch("SEEKER"),
});

const en = createT("en");

/** Better Auth's error codes → the website's English messages. */
const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: en("auth.errExists"),
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: en("auth.errExists"),
  WEAK_PASSWORD_COMMON: en("auth.weak.common"),
  WEAK_PASSWORD_REPEATED: en("auth.weak.repeated"),
  WEAK_PASSWORD_SEQUENCE: en("auth.weak.sequence"),
  WEAK_PASSWORD_PERSONAL: en("auth.weak.personal"),
  PASSWORD_TOO_SHORT: en("auth.errShort"),
  PASSWORD_TOO_LONG: en("auth.errLong"),
};

// POST /api/mobile/auth/register  { name, email, password, intent }  →  201 { status: "verify-email" }
// Creates the account through Better Auth's own sign-up (the website's password rules: at least 10 characters, not
// common, repeated, sequential or personal). As on the website, the member must open the link we email before they
// can sign in — the app then signs in with the same email and password.
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "body")))];
    return NextResponse.json({ error: { code: "INVALID_FIELDS", message: "Check your name and email.", fields } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const res = await forwardToAuth(req, "/sign-up/email", { ...parsed.data, callbackURL: "/onboarding" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string };
    if (res.status === 429) return mobileError(429, "RATE_LIMITED", en("auth.errRate"));
    const code = err.code ?? "SIGN_UP_FAILED";
    return mobileError(res.status >= 500 ? 502 : code.startsWith("USER_ALREADY") ? 409 : 400, code, MESSAGES[code] ?? "Sign-up failed. Try again.");
  }
  return NextResponse.json({ status: "verify-email" }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
