import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { createStory, listStories, STORY_TEXT_MAX } from "@/server/services/stories";
import { videoMedia } from "@/server/services/video-media";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";

export const dynamic = "force-dynamic";

// GET /api/mobile/stories  →  { groups: [{ user, mine, hasUnseen, latestAt, stories: [{ id, mediaUrl, mediaType,
//                                thumbnailUrl, text, createdAt, expiresAt, seen, viewCount }] }] }
// Live stories (the last 24 hours) from you, your connections and the people you follow, one group per member:
// yours first, then members with stories you haven't seen, then the rest. viewCount is only set on your own.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  return NextResponse.json({ groups: await listStories(session.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

const fields = z.object({ text: z.string().trim().max(STORY_TEXT_MAX).nullable() });

// POST /api/mobile/stories  (multipart/form-data: image, text?  — or videoUrl, thumbnailUrl?, text?)  →  201 { story }
// One photo (checked by its real contents, like every upload) or one video already sent to /api/v1/media-upload
// (up to 60 s, compressed by the app), with an optional caption of up to 250 characters.
// It disappears from everyone's stories 24 hours later. At most 20 stories a day.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const limit = rateLimit(`${LIMITS.story.key}:${userId}`, LIMITS.story.max, LIMITS.story.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `You've shared a lot of stories today. Try again in ${Math.ceil(limit.retryAfterSeconds / 3600)} h.`);

  const form = await req.formData().catch(() => null);
  if (!form) return mobileError(400, "INVALID_BODY", "Send the story as multipart form data.");
  const parsed = fields.safeParse({ text: (form.get("text") as string | null) || null });
  if (!parsed.success) return mobileError(400, "INVALID_FIELDS", `Keep the caption under ${STORY_TEXT_MAX} characters.`);
  const videoUrl = form.get("videoUrl");
  if (videoUrl) {
    const video = await videoMedia(userId, videoUrl, form.get("thumbnailUrl"));
    if ("problem" in video) return mobileError(400, "VIDEO_NOT_FOUND", resolveMessage(createT("en"), video.problem));
    const story = await createStory(userId, video.videoUrl, parsed.data.text || null, video);
    return NextResponse.json({ story }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) return mobileError(400, "IMAGE_REQUIRED", "Choose a photo for your story.");

  let mediaUrl: string;
  try {
    mediaUrl = (await storeUpload(image, "story", userId)).url;
  } catch (e) {
    if (e instanceof UploadError) return mobileError(400, "INVALID_IMAGE", resolveMessage(createT("en"), e.message));
    throw e;
  }

  try {
    const story = await createStory(userId, mediaUrl, parsed.data.text || null);
    return NextResponse.json({ story }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await deleteStored([mediaUrl]);
    throw e;
  }
}
