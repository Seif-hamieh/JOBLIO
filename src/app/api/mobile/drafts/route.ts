import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { listDrafts, saveDraft } from "@/server/services/post-drafts";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { readDraftForm, toDraft } from "@/server/mobile/drafts";

export const dynamic = "force-dynamic";

// GET /api/mobile/drafts  →  { drafts: [{ id, content, visibility, mediaUrls, updatedAt }] }  (latest edited first)
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const drafts = await listDrafts(session.user.id);
  return NextResponse.json({ drafts: drafts.map(toDraft) }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/mobile/drafts  (multipart: content?, visibility?, image?)  →  201 { draft }
// Saves a new draft; the text may still be empty. Up to 50 drafts per member.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.write.key}:${userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const r = await readDraftForm(req, userId, null);
  if ("error" in r) return r.error;
  const draft = await saveDraft(userId, null, r.d, [], r.added);
  if (!draft) {
    await r.discard();
    return mobileError(409, "TOO_MANY_DRAFTS", "You have too many drafts. Publish or delete some first.");
  }
  return NextResponse.json({ draft: toDraft(draft) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
