import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";
import { APP_URL } from "@/lib/utils";
import { rateLimit } from "@/server/rate-limit";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { CHAT_MAX_BYTES, chatKindForMime, storeChatStream, UploadError } from "@/server/storage";

export const dynamic = "force-dynamic";

// POST /api/v1/chat-upload?c=<conversationId>&name=<file name>   body: the file's raw bytes  →  201 { url, name, size, mime, kind }
// Step 1 of sending an image, voice message or document in chat (step 2 sends the message with the returned url).
// Used by the website (session cookie) and the app (Authorization: Bearer). Up to 100 MB, written to disk as it
// arrives. This path is left out of src/proxy.ts, which would otherwise hold the body in memory first.
export async function POST(req: Request) {
  const mobile = await getMobileSession(req);
  // A cookie is sent by the browser on its own, so with one the request must come from the site itself.
  const web = mobile ? null : new URL(APP_URL).origin === req.headers.get("origin") ? await auth.api.getSession({ headers: req.headers }) : null;
  const session = mobile ?? web;
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");

  const limit = rateLimit(`chat-upload:${session.user.id}`, 30, 10 * 60_000);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `Too many uploads. Try again in ${limit.retryAfterSeconds} s.`);

  const query = new URL(req.url).searchParams;
  const conversationId = (query.get("c") ?? "").slice(0, 64);
  const name = (query.get("name") ?? "").slice(0, 200);
  // Refused before reading anything: a declared size over the limit, or no body at all.
  if (Number(req.headers.get("content-length") ?? 0) > CHAT_MAX_BYTES) return refuse(413, "UPLOAD_TOO_BIG", "@msg.uploadTooBig?{\"mb\":100}");
  if (!req.body) return refuse(400, "UPLOAD_CHOOSE", "@msg.uploadChoose");

  const member = conversationId && (await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: session.user.id } }, select: { userId: true } }));
  if (!member) return mobileError(404, "CONV_NOT_FOUND", "Conversation not found.");

  try {
    const file = await storeChatStream(req.body, name, conversationId);
    return NextResponse.json({ url: file.url, name: file.name, size: file.size, mime: file.mime, kind: chatKindForMime(file.mime) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof UploadError) return refuse(e.message.startsWith("@msg.uploadTooBig") ? 413 : 400, "UPLOAD_REFUSED", e.message);
    throw e;
  }
}

/** The error in English, plus its key so the website can show it in the reader's language. */
function refuse(status: number, code: string, key: string) {
  return NextResponse.json({ error: { code, key, message: resolveMessage(createT("en"), key) } }, { status, headers: { "Cache-Control": "no-store" } });
}
