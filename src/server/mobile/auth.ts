import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import type { z } from "zod";
import { ActionError, parse } from "@/server/action";
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

/**
 * Sends an app request through one of Better Auth's own endpoints (sign-in, sign-up, password reset…), so the app
 * gets exactly the website's checks and rate limits. The client's address and browser headers are passed on, since
 * Better Auth limits attempts per client address.
 */
export async function forwardToAuth(req: Request, path: string, body: unknown, sessionToken?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const h of ["x-forwarded-for", "x-real-ip", "user-agent", "accept-language"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Signed-in endpoints (change password / email): the app's bearer token becomes the session cookie, and the request
  // is marked as coming from the site itself, which Better Auth's cross-site check expects alongside a cookie.
  if (sessionToken) {
    headers.set("cookie", (await sessionHeaders(sessionToken)).get("cookie")!);
    headers.set("origin", new URL(process.env.BETTER_AUTH_URL!).origin);
  }
  return auth.handler(new Request(new URL(`/api/auth${path}`, process.env.BETTER_AUTH_URL), { method: "POST", headers, body: JSON.stringify(body) }));
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

/**
 * For "my profile" endpoints: the signed-in member with their profile id and username (what the profile-editing
 * service needs), or a ready error response (401 not signed in, 409 no profile yet — onboarding not finished).
 */
export async function getMobileOwner(req: Request): Promise<{ owner: { id: string; name: string; profileId: string; username: string } } | { error: NextResponse }> {
  const session = await getMobileSession(req);
  if (!session) return { error: mobileError(401, "UNAUTHORIZED", "Sign in first.") };
  const profile = await db.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile || !session.user.username) return { error: mobileError(409, "NO_PROFILE", "Finish setting up your profile on the website first.") };
  return { owner: { id: session.user.id, name: session.user.name, profileId: profile.id, username: session.user.username } };
}

/**
 * Validates a request body with one of the website's form schemas (same rules, same limits). On failure, a 400
 * INVALID_FIELDS response naming the rejected fields, with the first problem in the website's English wording.
 */
export function parseMobile<S extends z.ZodType>(schema: S, input: unknown): { data: z.infer<S> } | { error: NextResponse } {
  const parsed = parse(schema, input);
  if (parsed.success) return { data: parsed.data };
  const fields = Object.keys(parsed.state.fieldErrors ?? {});
  return {
    error: NextResponse.json(
      { error: { code: "INVALID_FIELDS", message: resolveMessage(createT("en"), parsed.state.error), fields } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    ),
  };
}

/** A website rule that refused the request (an ActionError) as a 409 (404 for "not found") in the website's English wording. */
export function actionErrorResponse(e: unknown) {
  if (!(e instanceof ActionError)) return null;
  // @msg.alreadyApplied → ALREADY_APPLIED, @admin.msg.notSelf → NOT_SELF (the last part of the key, without its values)
  const key = e.message.replace(/^@/, "").split("?")[0]!;
  const code = key.slice(key.lastIndexOf(".") + 1).replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
  // "Not found" also covers another company's application: no hint that it exists.
  return mobileError(code.endsWith("NOT_FOUND") ? 404 : 409, code, resolveMessage(createT("en"), e.message));
}
