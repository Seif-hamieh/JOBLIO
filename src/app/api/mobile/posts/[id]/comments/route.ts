import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { addPostComment } from "@/server/services/post-interactions";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toComment } from "@/server/mobile/feed";

export const dynamic = "force-dynamic";

const body = z.object({ content: z.string().trim().min(1).max(1500) });

// POST /api/mobile/posts/:id/comments  { content }  →  201 { comment }
// Same as commenting on the website: the post must be visible to the member, and its author is notified.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/posts/[id]/comments">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const limit = rateLimit(`${LIMITS.comment.key}:${session.user.id}`, LIMITS.comment.max, LIMITS.comment.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many comments. Try again in ${limit.retryAfterSeconds} s.`);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Write a comment (up to 1,500 characters).");
  const { id } = await params;
  const comment = await addPostComment({ id: session.user.id, name: session.user.name }, id.slice(0, 40), parsed.data.content);
  if (!comment) return mobileError(404, "NOT_FOUND", "This post doesn't exist or was removed.");
  return NextResponse.json({ comment: toComment(comment, session.user.id) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
