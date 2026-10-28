import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getPost } from "@/server/services/feed";
import { authorFor } from "@/server/services/posting";
import { getDraft, publishDraft } from "@/server/services/post-drafts";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPost } from "@/server/mobile/feed";
import { messageText, readDraftForm } from "@/server/mobile/drafts";

export const dynamic = "force-dynamic";

// POST /api/mobile/drafts/:id/publish  (multipart, as PUT)  →  201 { post }
// Publishes the draft with the latest edits: the same checks as posting directly; the draft is then gone.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/drafts/[id]/publish">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const limit = rateLimit(`${LIMITS.post.key}:${userId}`, LIMITS.post.max, LIMITS.post.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `You've posted a lot recently. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
  const id = (await params).id.slice(0, 40);
  const existing = await getDraft(userId, id);
  if (!existing) return mobileError(404, "NOT_FOUND", "That draft no longer exists.");
  const r = await readDraftForm(req, userId, existing);
  if ("error" in r) return r.error;
  const result = await publishDraft(await authorFor(userId), id, r.d, r.kept, r.added);
  if ("problem" in result) {
    await r.discard();
    return mobileError(400, "CANNOT_PUBLISH", messageText(result.problem));
  }
  revalidatePath("/feed");
  revalidatePath("/home");
  const post = await getPost(userId, result.postId);
  return NextResponse.json({ post: post && toPost(post, userId) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
