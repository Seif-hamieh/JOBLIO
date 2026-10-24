import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

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
