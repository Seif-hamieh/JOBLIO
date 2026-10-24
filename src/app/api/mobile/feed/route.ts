import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getFeed } from "@/server/services/feed";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPost } from "@/server/mobile/feed";

export const dynamic = "force-dynamic";

// GET /api/mobile/feed?cursor=<last post id>  →  { posts, nextCursor }
// The website's feed, 10 posts a page, newest first: your posts, your connections, people and companies you
// follow, then recent public posts. No ranking model. nextCursor is null on the last page.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.search.key}:${session.user.id}`, LIMITS.search.max, LIMITS.search.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  }
  const cursor = new URL(req.url).searchParams.get("cursor")?.slice(0, 40) || undefined;
  const { posts, nextCursor } = await getFeed(session.user.id, { cursor });
  return NextResponse.json({ posts: posts.map((p) => toPost(p, session.user.id)), nextCursor }, { headers: { "Cache-Control": "private, no-store" } });
}
