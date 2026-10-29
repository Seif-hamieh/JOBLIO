import "server-only";
import { statMediaFile } from "@/server/storage";

/** The longest video, in seconds: checked in the app and the browser before uploading (the server can't cheaply). */
export const VIDEO_MAX_SECONDS = { story: 60, post: 180 } as const;

export type VideoMedia = { mediaType: "VIDEO"; videoUrl: string; thumbnailUrl: string | null };

/**
 * Checks a video picked for a post or story: it was uploaded by this member through /api/v1/media-upload, and so is
 * its still frame when one is given. Returns the media to save, or an error key.
 */
export async function videoMedia(userId: string, videoUrl: unknown, thumbnailUrl: unknown): Promise<VideoMedia | { problem: string }> {
  if (typeof videoUrl !== "string" || !(await statMediaFile(videoUrl, userId, "video"))) return { problem: "@msg.videoMissing" };
  const thumb = typeof thumbnailUrl === "string" && thumbnailUrl ? thumbnailUrl : null;
  if (thumb && !(await statMediaFile(thumb, userId, "image"))) return { problem: "@msg.videoMissing" };
  return { mediaType: "VIDEO", videoUrl, thumbnailUrl: thumb };
}
