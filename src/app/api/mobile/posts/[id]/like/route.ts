import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { setPostLike } from "@/server/services/post-interactions";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// PUT /api/mobile/posts/:id/like     →  { liked: true, count }
// DELETE /api/mobile/posts/:id/like  →  { liked: false, count }
// The app lights the heart instantly and sends the state it wants, so a repeated tap is harmless. Same service as
// the website's like button (one "liked your post" notification per post at most).
async function handle(req: Request, { params }: RouteContext<"/api/mobile/posts/[id]/like">, like: boolean) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.like.key}:${session.user.id}`, LIMITS.like.max, LIMITS.like.windowMs).ok) {
    return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  }
  const { id } = await params;
  const result = await setPostLike({ id: session.user.id, name: session.user.name }, id.slice(0, 40), like);
  if (!result) return mobileError(404, "NOT_FOUND", "This post doesn't exist or was removed.");
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export function PUT(req: Request, ctx: RouteContext<"/api/mobile/posts/[id]/like">) {
  return handle(req, ctx, true);
}

export function DELETE(req: Request, ctx: RouteContext<"/api/mobile/posts/[id]/like">) {
  return handle(req, ctx, false);
}
