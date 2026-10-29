import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { keyFromUrl, privateFileLink, statChatFile } from "@/server/storage";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

const body = z.object({ url: z.string().max(300) });

// POST /api/mobile/conversations/:id/file-link  { url }  →  { url }
// A 10-minute link to a file sent in this conversation, for the phone's browser (which can't send the app's sign-in).
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/conversations/[id]/file-link">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Which file?");
  const conversationId = (await params).id.slice(0, 64);
  const member = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: session.user.id } }, select: { userId: true } });
  const key = keyFromUrl(parsed.data.url);
  if (!member || !key || !(await statChatFile(parsed.data.url, conversationId))) return mobileError(404, "NOT_FOUND", "That file is no longer available.");
  const url = await privateFileLink(key, 600);
  if (!url) return mobileError(404, "NOT_FOUND", "That file is no longer available.");
  return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
