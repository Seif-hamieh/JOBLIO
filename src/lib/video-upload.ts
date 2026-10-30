"use client";

// Videos in posts (up to 3 min) and stories (up to 60 s) from the website. The browser checks the file first (type,
// 20 MB, length) and makes its still frame; then both go up in two steps — the bytes to /api/v1/media-upload
// (streamed to disk there), then the post or story with the returned urls. The server never re-encodes anything.

/** The server's limit for one video (20 MB). */
export const VIDEO_MAX_BYTES = 20 * 1000 * 1000;
export const VIDEO_MAX_SECONDS = { story: 60, post: 180 } as const;
export const VIDEO_ACCEPT = "video/mp4,video/quicktime,.mp4,.mov";

export type PickedVideo = { file: File; url: string; duration: number; width: number; height: number; thumbnail: Blob | null };

/**
 * Checks a chosen video and grabs its still frame. Rejects with a message key ("@feed.…") to show. The object URL
 * in the result is for the preview; revoke it when the video is removed.
 */
export async function inspectVideo(file: File, purpose: keyof typeof VIDEO_MAX_SECONDS): Promise<PickedVideo> {
  if (!/\.(mp4|mov)$/i.test(file.name) && !/^video\/(mp4|quicktime)$/.test(file.type)) throw new Error("@feed.videoType");
  if (file.size > VIDEO_MAX_BYTES) throw new Error("@feed.videoTooBig");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("@feed.videoUnreadable"));
    });
    // A second over is rounding, not a longer video.
    if (video.duration > VIDEO_MAX_SECONDS[purpose] + 1) throw new Error(purpose === "story" ? "@feed.videoTooLongStory" : "@feed.videoTooLongPost");
    const thumbnail = await stillFrame(video);
    return { file, url, duration: video.duration, width: video.videoWidth, height: video.videoHeight, thumbnail };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  } finally {
    video.removeAttribute("src");
  }
}

/** A frame just after the start as a JPEG at most 720 px wide, or null when the browser can't draw it. */
async function stillFrame(video: HTMLVideoElement): Promise<Blob | null> {
  try {
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("seek"));
      video.currentTime = Math.min(0.5, video.duration / 2 || 0);
    });
    const scale = Math.min(1, 720 / (video.videoWidth || 720));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

/** Sends one file's bytes, reporting progress (0–100). Rejects with a message key. XHR: fetch can't report progress. */
function uploadMedia(body: Blob, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/media-upload");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { url?: string; error?: { key?: string } } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 201 && data.url) resolve(data.url);
      else reject(new Error(data.error?.key ?? (xhr.status === 413 ? "@feed.videoTooBig" : "@feed.videoNotSent")));
    };
    xhr.onerror = () => reject(new Error("@feed.videoNotSent"));
    xhr.send(body);
  });
}

/** Uploads the video, then its still frame (one that fails to go up doesn't stop the video being shared). */
export async function uploadVideo(video: PickedVideo, onProgress: (pct: number) => void) {
  const videoUrl = await uploadMedia(video.file, onProgress);
  const thumbnailUrl = video.thumbnail ? await uploadMedia(video.thumbnail).catch(() => null) : null;
  return { videoUrl, thumbnailUrl };
}
