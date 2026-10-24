import { NextResponse } from "next/server";
import { getComments, getPost } from "@/server/services/feed";
import { canSeePost } from "@/server/services/post-interactions";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toComment, toPost } from "@/server/mobile/feed";

export const dynamic = "force-dynamic";

// GET /api/mobile/posts/:id  →  { post, comments }
// One post with its comments (oldest first, up to 100), if this member may see it.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/posts/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const { id } = await params;
  const visible = await canSeePost(session.user.id, id.slice(0, 40));
  if (!visible) return mobileError(404, "NOT_FOUND", "This post doesn't exist or was removed.");
  const [post, comments] = await Promise.all([getPost(session.user.id, visible.id), getComments(visible.id)]);
  if (!post) return mobileError(404, "NOT_FOUND", "This post doesn't exist or was removed.");
  return NextResponse.json(
    { post: toPost(post, session.user.id), comments: comments.map((c) => toComment(c, session.user.id)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
