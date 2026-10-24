import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { ensureConversation } from "@/server/services/messaging";
import { actionErrorResponse, getMobileSession, mobileError } from "@/server/mobile/auth";
import { hasRecruiterPro } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

// POST /api/mobile/members/:username/message  →  { conversationId }
// The profile's "Message" button: opens (or reuses) the 1:1 conversation. The website's rules apply — the member's
// message settings, blocks, and recruiters' monthly limit on new conversations.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/members/[username]/message">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const me = session.user.id;
  if (!rateLimit(`${LIMITS.message.key}:${me}`, LIMITS.message.max, LIMITS.message.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  const { username } = await params;
  const other = await db.user.findUnique({ where: { username: decodeURIComponent(username).slice(0, 40).toLowerCase() }, select: { id: true } });
  if (!other || other.id === me) return mobileError(404, "NOT_FOUND", "This member doesn't exist.");
  const isRecruiter = !!(await db.companyMember.findFirst({ where: { userId: me }, select: { id: true } }));
  try {
    const conversationId = await ensureConversation({ id: me, isRecruiter, recruiterPro: isRecruiter && (await hasRecruiterPro(me)) }, other.id);
    return NextResponse.json({ conversationId }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
