import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";
import { APP_URL } from "@/lib/utils";
import { rateLimit } from "@/server/rate-limit";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { MEDIA_MAX_BYTES, storeMediaStream, UploadError } from "@/server/storage";

export const dynamic = "force-dynamic";

// POST /api/v1/media-upload   body: the file's raw bytes  →  201 { url, size, mime, kind: "VIDEO" | "IMAGE" }
// Step 1 of a video post or story: the video (MP4/MOV, already compressed by the app or browser) and then its still
// frame (JPG/PNG/WebP) are each sent here; step 2 creates the post or story with the two returned urls.
// Used by the website (session cookie) and the app (Authorization: Bearer). Up to 20 MB, written to disk as it
// arrives. This path is left out of src/proxy.ts, which would otherwise hold the body in memory first.
export async function POST(req: Request) {
  const mobile = await getMobileSession(req);
  // A cookie is sent by the browser on its own, so with one the request must come from the site itself.
  const web = mobile ? null : new URL(APP_URL).origin === req.headers.get("origin") ? await auth.api.getSession({ headers: req.headers }) : null;
  const session = mobile ?? web;
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");

  // A video and its still frame per post or story: 30 uploads an hour is 15 videos.
  const limit = rateLimit(`media-upload:${session.user.id}`, 30, 60 * 60_000);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many uploads. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);

  if (Number(req.headers.get("content-length") ?? 0) > MEDIA_MAX_BYTES) return refuse(413, "UPLOAD_TOO_BIG", "@msg.uploadTooBig?{\"mb\":20}");
  if (!req.body) return refuse(400, "UPLOAD_CHOOSE", "@msg.uploadChoose");

  try {
    const file = await storeMediaStream(req.body, session.user.id);
    return NextResponse.json(
      { url: file.url, size: file.size, mime: file.mime, kind: file.mime.startsWith("video/") ? "VIDEO" : "IMAGE" },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof UploadError) return refuse(e.message.startsWith("@msg.uploadTooBig") ? 413 : 400, "UPLOAD_REFUSED", e.message);
    throw e;
  }
}

/** The error in English, plus its key so the website can show it in the reader's language. */
function refuse(status: number, code: string, key: string) {
  return NextResponse.json({ error: { code, key, message: resolveMessage(createT("en"), key) } }, { status, headers: { "Cache-Control": "no-store" } });
}
