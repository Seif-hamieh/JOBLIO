import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp } from "@/lib/csp";
import { db } from "@/server/db";
import { RESERVED_USERNAMES } from "@/lib/constants";

// Optimistic routing only: checks for the presence of a session cookie to
// avoid rendering protected pages for signed-out visitors. Real authorization
// happens in the data access layer (src/server/session.ts) on every request.

const PROTECTED = [
  "/home",
  "/feed",
  "/network",
  "/messages",
  "/notifications",
  "/profile",
  "/applications",
  "/interviews",
  "/settings",
  "/recruiter",
  "/company",
  "/jobs/for-you",
  "/jobs/saved",
];

// Pages under (app) stream behind a loading boundary, which commits a 200 status
// before the page can call notFound(). For full page loads of public detail pages,
// check existence first so a missing job / company / profile answers 404.
const DETAIL = /^\/(jobs|companies|in)\/([^/]+)$/;
const NOT_A_JOB = new Set(["featured", "saved", "for-you"]);

// A single segment that isn't one of the site's own top-level pages is a member's portfolio
// (/{username}). Next renders a missing one as an empty shell plus a client-drawn 404, so on
// full page loads check the member first and answer with the real 404 page instead.
const SINGLE = /^\/([^/]+)$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,38}$/i;

async function memberExists(name: string) {
  return USERNAME.test(name) && !!(await db.user.findUnique({ where: { username: name }, select: { id: true } }));
}

async function exists(kind: string, key: string) {
  if (kind === "jobs") return NOT_A_JOB.has(key) || !!(await db.job.findUnique({ where: { id: key }, select: { id: true } }));
  if (kind === "companies") return !!(await db.company.findUnique({ where: { slug: key }, select: { id: true } }));
  return !!(await db.user.findUnique({ where: { username: key }, select: { id: true } }));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const detail = pathname.match(DETAIL);
  if (detail && request.method === "GET" && !request.headers.get("rsc")) {
    const ok = await exists(detail[1]!, decodeURIComponent(detail[2]!)).catch(() => true); // never block a page on a DB hiccup
    // A path no route matches renders the not-found page with a real 404 status.
    if (!ok) return NextResponse.rewrite(new URL("/_missing/not-found", request.url), { status: 404 });
  }

  // Only document loads (not RSC, not images/files such as /apple-icon.png).
  const single = pathname.match(SINGLE);
  if (single && request.method === "GET" && !request.headers.get("rsc") && request.headers.get("accept")?.includes("text/html")) {
    const name = decodeURIComponent(single[1]!);
    if (!RESERVED_USERNAMES.has(name.toLowerCase())) {
      const ok = await memberExists(name).catch(() => true); // never block a page on a DB hiccup
      if (!ok) return NextResponse.rewrite(new URL("/_missing/not-found", request.url), { status: 404 });
    }
  }

  // A fresh nonce per request: Next reads it from the request's CSP header and adds it to its scripts.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const forward = new Headers(request.headers);
  forward.set("x-pathname", pathname); // the page's canonical URL (root layout)
  forward.set("x-nonce", nonce);
  forward.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: forward } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    "/((?!api|monitoring|_next/static|_next/image|media|icon.svg|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image|sw.js|offline.html|manifest.webmanifest|icon-|apple-touch-icon|apple-icon).*)",
  ],
};
