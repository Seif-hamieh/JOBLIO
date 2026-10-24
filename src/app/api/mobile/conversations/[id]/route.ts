import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { getThread, markConversationRead, messageSelect } from "@/server/services/messaging";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toMessage, toOther } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

// GET /api/mobile/conversations/:id              →  { conversation, messages }   (the latest 50)
// GET /api/mobile/conversations/:id?after=<iso>  →  { messages, otherLastReadAt } (only newer ones: the app polls
//                                                    this every few seconds while the chat is open — a small query)
// Either way, messages from the other person mark the conversation read for this member.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/conversations/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  // Polling every 4 s is 15 requests a minute; the limit leaves room for a second open device.
  if (!rateLimit(`chat-poll:${userId}`, 60, 60_000).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { id } = await params;
  const conversationId = id.slice(0, 64);
  const after = new URL(req.url).searchParams.get("after");

  if (after) {
    const since = new Date(after);
    if (Number.isNaN(since.getTime())) return mobileError(400, "INVALID_AFTER", "after must be an ISO date.");
    const [me, other] = await Promise.all([
      db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } }, select: { userId: true } }),
      db.conversationParticipant.findFirst({ where: { conversationId, userId: { not: userId } }, select: { lastReadAt: true } }),
    ]);
    if (!me) return mobileError(404, "NOT_FOUND", "This conversation doesn't exist.");
    const messages = await db.message.findMany({ where: { conversationId, createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: 100, select: messageSelect });
    if (messages.some((m) => m.senderId !== userId)) await markConversationRead(conversationId, userId);
    return NextResponse.json(
      { messages: messages.map((m) => toMessage(m, userId)), otherLastReadAt: other?.lastReadAt?.toISOString() ?? null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const thread = await getThread(conversationId, userId, { take: 50 });
  if (!thread) return mobileError(404, "NOT_FOUND", "This conversation doesn't exist.");
  await markConversationRead(conversationId, userId);
  return NextResponse.json(
    {
      conversation: { id: thread.id, other: toOther(thread.other), otherLastReadAt: thread.otherLastReadAt?.toISOString() ?? null },
      messages: thread.messages.map((m) => toMessage(m, userId)),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
