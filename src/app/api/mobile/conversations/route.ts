import { NextResponse } from "next/server";
import { listConversations } from "@/server/services/messaging";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toConversation } from "@/server/mobile/messages";

export const dynamic = "force-dynamic";

// GET /api/mobile/conversations  →  { conversations }
// The member's inbox (most recent first, archived ones left out), as on the website's Messages page.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const list = await listConversations(session.user.id);
  return NextResponse.json({ conversations: list.map((c) => toConversation(c, session.user.id)) }, { headers: { "Cache-Control": "private, no-store" } });
}
