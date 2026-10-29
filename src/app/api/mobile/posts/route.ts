import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getPost } from "@/server/services/feed";
import { videoMedia } from "@/server/services/video-media";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPost } from "@/server/mobile/feed";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";

export const dynamic = "force-dynamic";

const fields = z.object({
  content: z.string().trim().min(1).max(3000),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).catch("PUBLIC"),
});

// POST /api/mobile/posts  (multipart/form-data: content, visibility?, image? — or videoUrl, thumbnailUrl?)  →  201 { post }
// A personal update, like the website's composer: up to 3,000 characters, public or connections-only, with one
// optional image (checked by its real contents, as on the website) or one video already sent to
// /api/v1/media-upload (up to 3 min, compressed by the app). Same hourly post limit as the website.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const limit = rateLimit(`${LIMITS.post.key}:${userId}`, LIMITS.post.max, LIMITS.post.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `You've posted a lot recently. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);

  const form = await req.formData().catch(() => null);
  if (!form) return mobileError(400, "INVALID_BODY", "Send the post as multipart form data.");
  const parsed = fields.safeParse({ content: form.get("content"), visibility: form.get("visibility") ?? "PUBLIC" });
  if (!parsed.success) return mobileError(400, "INVALID_FIELDS", "Write something (up to 3,000 characters).");

  const mediaUrls: string[] = [];
  let video: { thumbnailUrl: string | null } | undefined;
  const image = form.get("image");
  if (form.get("videoUrl")) {
    const v = await videoMedia(userId, form.get("videoUrl"), form.get("thumbnailUrl"));
    if ("problem" in v) return mobileError(400, "VIDEO_NOT_FOUND", resolveMessage(createT("en"), v.problem));
    mediaUrls.push(v.videoUrl);
    video = v;
  } else if (image instanceof File && image.size > 0) {
    try {
      mediaUrls.push((await storeUpload(image, "post", userId)).url);
    } catch (e) {
      if (e instanceof UploadError) return mobileError(400, "INVALID_IMAGE", resolveMessage(createT("en"), e.message));
      throw e;
    }
  }

  let postId: string;
  try {
    ({ id: postId } = await db.post.create({
      data: { authorId: userId, content: parsed.data.content, type: "UPDATE", visibility: parsed.data.visibility, mediaUrls, ...(video && { mediaType: "VIDEO", thumbnailUrl: video.thumbnailUrl }) },
      select: { id: true },
    }));
  } catch (e) {
    await deleteStored([...mediaUrls, video?.thumbnailUrl]);
    throw e;
  }
  revalidatePath("/feed");
  revalidatePath("/home");
  const post = await getPost(userId, postId);
  return NextResponse.json({ post: post && toPost(post, userId) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
