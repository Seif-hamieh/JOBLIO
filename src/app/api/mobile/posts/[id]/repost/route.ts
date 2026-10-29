import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getPost } from "@/server/services/feed";
import { repostPost } from "@/server/services/post-interactions";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPost } from "@/server/mobile/feed";

export const dynamic = "force-dynamic";

const body = z.object({ content: z.string().max(3000).optional() });

// POST /api/mobile/posts/:id/repost  { content? }  →  201 { post }
// Reposts the post to your own feed (reposting a repost shares the original), like the website's Repost button.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/posts/[id]/repost">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const limit = rateLimit(`${LIMITS.post.key}:${userId}`, LIMITS.post.max, LIMITS.post.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `You've posted a lot recently. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Your words can be up to 3,000 characters.");
  const repost = await repostPost({ id: userId, name: session.user.name }, (await params).id.slice(0, 40), parsed.data.content ?? "");
  if (!repost) return mobileError(404, "NOT_FOUND", "That post no longer exists.");
  revalidatePath("/feed");
  const post = await getPost(userId, repost.id);
  return NextResponse.json({ post: post && toPost(post, userId) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
