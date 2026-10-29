import { NextResponse } from "next/server";
import { z } from "zod";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { chatMedia, chatMediaSchema, sendMessage } from "@/server/services/messaging";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";
import { toMessage } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

// Text, and/or a file uploaded first to /api/v1/chat-upload (image, voice message, document), or a location.
const body = z
  .object({ body: z.string().trim().max(5000).default("") })
  .extend(chatMediaSchema.shape)
  .refine((b) => b.body || b.attachmentUrl || (b.latitude !== undefined && b.longitude !== undefined));

// POST /api/mobile/conversations/:id/messages  { body?, attachmentUrl?, attachmentName?, latitude?, longitude? }  →  201 { message }
// Sends a text message through the website's sendMessage: membership and blocks are checked, the conversation is
// re-opened for both sides, and the other person gets the website's "new message" notification.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/conversations/[id]/messages">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const limit = rateLimit(`${LIMITS.message.key}:${session.user.id}`, LIMITS.message.max, LIMITS.message.windowMs);
  if (!limit.ok) return mobileError(429, "RATE_LIMITED", `You're sending messages too fast. Try again in ${limit.retryAfterSeconds} s.`);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Write a message (up to 5,000 characters), or attach a file or a location.");
  const { id } = await params;
  try {
    const conversationId = id.slice(0, 64);
    const media = await chatMedia(conversationId, parsed.data);
    const message = await sendMessage({ id: session.user.id, name: session.user.name }, conversationId, { body: parsed.data.body, kind: "TEXT", ...media });
    return NextResponse.json({ message: toMessage(message, session.user.id) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
