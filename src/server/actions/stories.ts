"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { createStory, deleteOwnStory, markStoryViewed, STORY_TEXT_MAX } from "@/server/services/stories";
import { videoMedia } from "@/server/services/video-media";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";

// Stories on the website: the same rules as the app's /api/mobile/stories (a photo, or a video already sent to
// /api/v1/media-upload; an optional caption; up to 20 a day; gone after 24 hours).

const id = z.string().min(1).max(40);
const caption = z.string().trim().max(STORY_TEXT_MAX);

/** Shares a story from the form: "image" (a photo) or "videoUrl" + "thumbnailUrl", and "text". */
export async function createStoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return withViewer({ limit: LIMITS.story }, async (viewer) => {
    const text = caption.safeParse(form.get("text") ?? "");
    if (!text.success) return fail("@v.invalid");
    const videoUrl = form.get("videoUrl");
    if (videoUrl) {
      const video = await videoMedia(viewer.id, videoUrl, form.get("thumbnailUrl"));
      if ("problem" in video) return fail(video.problem);
      await createStory(viewer.id, video.videoUrl, text.data || null, video);
    } else {
      const image = form.get("image");
      if (!(image instanceof File) || image.size === 0) return fail("@msg.uploadChoose");
      let mediaUrl: string;
      try {
        mediaUrl = (await storeUpload(image, "story", viewer.id)).url;
      } catch (e) {
        if (e instanceof UploadError) return fail(e.message);
        throw e;
      }
      try {
        await createStory(viewer.id, mediaUrl, text.data || null);
      } catch (e) {
        await deleteStored([mediaUrl]);
        throw e;
      }
    }
    revalidatePath("/feed");
    return { ok: true, message: "@feed.storyShared" };
  });
}

/** The viewer showed a story (counted once; your own aren't). */
export async function markStoryViewedAction(storyId: string): Promise<void> {
  await withViewer({ limit: LIMITS.like }, async (viewer) => {
    await markStoryViewed(viewer.id, id.parse(storyId));
    return { ok: true };
  });
}

/** Deletes one of your own stories, with its photo or video. */
export async function deleteStoryAction(storyId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (!(await deleteOwnStory(viewer.id, id.parse(storyId)))) return fail("@msg.error");
    revalidatePath("/feed");
    return { ok: true, message: "@feed.storyDeleted" };
  });
}
