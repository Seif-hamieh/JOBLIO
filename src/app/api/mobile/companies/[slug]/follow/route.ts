import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { setCompanyFollow } from "@/server/services/company-follow";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// PUT /api/mobile/companies/:slug/follow     →  { following: true, followerCount }
// DELETE /api/mobile/companies/:slug/follow  →  { following: false, followerCount }
// Follow or unfollow a company page (its new jobs then show in your alerts). Repeating a request changes nothing.
async function handle(req: Request, { params }: RouteContext<"/api/mobile/companies/[slug]/follow">, follow: boolean) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { slug } = await params;
  const company = await db.company.findUnique({ where: { slug: decodeURIComponent(slug).slice(0, 80) }, select: { id: true } });
  if (!company) return mobileError(404, "NOT_FOUND", "This company page doesn't exist.");
  try {
    const following = await setCompanyFollow(session.user.id, company.id, follow);
    const { followerCount } = await db.company.findUniqueOrThrow({ where: { id: company.id }, select: { followerCount: true } });
    return NextResponse.json({ following, followerCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}

export function PUT(req: Request, ctx: RouteContext<"/api/mobile/companies/[slug]/follow">) {
  return handle(req, ctx, true);
}

export function DELETE(req: Request, ctx: RouteContext<"/api/mobile/companies/[slug]/follow">) {
  return handle(req, ctx, false);
}
