import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp } from "@/lib/csp";
import { db } from "@/server/db";
import { RESERVED_USERNAMES } from "@/lib/constants";
import { isBlockedBot } from "@/lib/bots";

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
  "/resume-builder",
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

// "missing": no such row (404). "gone": the row exists but is no longer public — a job that was
// closed, paused or never published, or an imported company with no open job — answered with
// 410 Gone so search engines drop the URL instead of reporting it as broken.
async function detailState(kind: string, key: string): Promise<"ok" | "missing" | "gone"> {
  if (kind === "jobs") {
    if (NOT_A_JOB.has(key)) return "ok";
    const job = await db.job.findUnique({ where: { id: key }, select: { status: true } });
    return !job ? "missing" : job.status === "OPEN" ? "ok" : "gone";
  }
  if (kind === "companies") {
    const company = await db.company.findUnique({
      where: { slug: key },
      select: { importSource: true, _count: { select: { jobs: { where: { status: "OPEN" } } } } },
    });
    return !company ? "missing" : company.importSource && company._count.jobs === 0 ? "gone" : "ok";
  }
  return (await db.user.findUnique({ where: { username: key }, select: { id: true } })) ? "ok" : "missing";
}

/**
 * Largest request body the site accepts (uploads are 4 MB at most; website forms 12 MB, see next.config). Chat files
 * (up to 100 MB) go to /api/v1/chat-upload, which this proxy skips and which enforces its own limit.
 */
const MAX_API_BODY = 10 * 1024 * 1024;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // API requests: only the size check. A declared body over the limit is refused before anything reads it; a body
  // sent without a declared size is buffered only up to the same limit (proxyClientMaxBodySize in next.config), so a
  // huge upload can't fill the server's memory.
  if (pathname.startsWith("/api/")) {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_API_BODY) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE", message: "The request is too large (10 MB at most)." }, { status: 413 });
    return NextResponse.next();
  }
  // AI-training and SEO scrapers: turned away before any page renders (they cost CPU and bring no visitors).
  if (isBlockedBot(request.headers.get("user-agent"))) return new NextResponse("Forbidden", { status: 403 });
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
    const state = await detailState(detail[1]!, decodeURIComponent(detail[2]!)).catch(() => "ok" as const); // never block a page on a DB hiccup
    // A path no route matches renders the not-found page with a real 404 status.
    if (state === "missing") return NextResponse.rewrite(new URL("/_missing/not-found", request.url), { status: 404 });
    // Removed listings: 410 for visitors (and crawlers). Signed-in members still reach the page,
    // which lets the posting team and admins see closed jobs and hidden companies.
    if (state === "gone" && !hasSession) {
      const gone = new URL("/gone", request.url);
      gone.searchParams.set("kind", detail[1] === "companies" ? "company" : "job");
      return NextResponse.rewrite(gone, { status: 410 });
    }
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
    // api/v1/chat-upload and api/v1/media-upload: chat files (100 MB) and videos (20 MB), streamed to disk by the
    // routes themselves (never held here).
    "/((?!api/v1/chat-upload|api/v1/media-upload|monitoring|_next/static|_next/image|media|icon.svg|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image|sw.js|offline.html|manifest.webmanifest|icon-|apple-touch-icon|apple-icon|social/|screenshots/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|txt|xml|json|webmanifest|js|css|map|woff2?|apk)$).*)",
  ],
};
