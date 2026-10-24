import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";

// Authentication for the mobile app's JSON API (/api/mobile/*). The app has no cookies: it sends the session token
// it got from /api/mobile/auth/login as "Authorization: Bearer <token>". Better Auth's bearer plugin is not used —
// it would also hand the token to the website's JavaScript on every web sign-in. Instead the token (the signed
// session-cookie value) is turned back into a cookie for this request only, and Better Auth verifies it as usual.

async function sessionCookieName() {
  return (await auth.$context).authCookies.sessionToken.name;
}

export function bearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header || header.slice(0, 7).toLowerCase() !== "bearer ") return null;
  const token = header.slice(7).trim();
  // A signed session token is "<token>.<signature>" (URL-encoded); anything else is not worth a lookup.
  return token && token.length <= 512 && token.includes(".") ? token : null;
}

/** Headers that make Better Auth see the bearer token as the session cookie. */
export async function sessionHeaders(token: string) {
  return new Headers({ cookie: `${await sessionCookieName()}=${token}` });
}

/** The signed-in member, or null (no token, or an expired / revoked / forged one). */
export async function getMobileSession(req: Request) {
  const token = bearerToken(req);
  if (!token) return null;
  return auth.api.getSession({ headers: await sessionHeaders(token), query: { disableCookieCache: true } }).catch(() => null);
}

/** Reads the session token from a Better Auth response's Set-Cookie headers. */
export async function tokenFromSetCookie(res: Response) {
  const name = await sessionCookieName();
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair!.indexOf("=");
    if (pair!.slice(0, eq).trim() === name) return pair!.slice(eq + 1).trim() || null;
  }
  return null;
}

export function mobileError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Lists and details that don't depend on who is asking may be cached by Vercel's CDN for a minute, so repeated
 * app requests don't run the function (Hobby-plan CPU). Anything personal (a bearer token was sent) is never cached.
 */
export function cacheHeaders(personal: boolean): HeadersInit {
  return personal
    ? { "Cache-Control": "private, no-store", Vary: "Authorization" }
    : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", Vary: "Authorization" };
}

/**
 * For recruiter endpoints: the signed-in member and the company they hire for (their first membership, as on the
 * website), or a ready error response (401 not signed in, 403 no company yet).
 */
export async function getMobileRecruiter(req: Request): Promise<{ userId: string; companyId: string } | { error: NextResponse }> {
  const session = await getMobileSession(req);
  if (!session) return { error: mobileError(401, "UNAUTHORIZED", "Sign in first.") };
  const m = await db.companyMember.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" }, select: { companyId: true } });
  if (!m) return { error: mobileError(403, "NO_COMPANY", "Create your company first.") };
  return { userId: session.user.id, companyId: m.companyId };
}

/** A website rule that refused the request (ActionError "@msg.x") as a 409 with the website's English wording. */
export function actionErrorResponse(e: unknown) {
  if (!(e instanceof ActionError)) return null;
  const code = e.message.replace(/^@msg\./, "").replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase(); // @msg.alreadyApplied → ALREADY_APPLIED
  // "Not found" also covers another company's application: no hint that it exists.
  return mobileError(code.endsWith("NOT_FOUND") ? 404 : 409, code, resolveMessage(createT("en"), e.message));
}
