import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

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

export function proxy(request: NextRequest) {
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

  // Let the root layout know the path, for the page's canonical URL.
  const forward = new Headers(request.headers);
  forward.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: forward } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|media|icon.svg|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image).*)"],
};
