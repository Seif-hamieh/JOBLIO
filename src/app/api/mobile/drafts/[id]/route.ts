import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { deleteDraft, getDraft, saveDraft } from "@/server/services/post-drafts";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { readDraftForm, toDraft } from "@/server/mobile/drafts";

export const dynamic = "force-dynamic";

const notFound = () => mobileError(404, "NOT_FOUND", "That draft no longer exists.");

// GET /api/mobile/drafts/:id  →  { draft }
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/drafts/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const draft = await getDraft(session.user.id, (await params).id.slice(0, 40));
  if (!draft) return notFound();
  return NextResponse.json({ draft: toDraft(draft) }, { headers: { "Cache-Control": "no-store" } });
}

// PUT /api/mobile/drafts/:id  (multipart: content?, visibility?, keepMedia* (images to keep), image?)  →  { draft }
// Images the draft had and keepMedia leaves out are deleted.
export async function PUT(req: Request, { params }: RouteContext<"/api/mobile/drafts/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.write.key}:${userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const id = (await params).id.slice(0, 40);
  const existing = await getDraft(userId, id);
  if (!existing) return notFound();
  const r = await readDraftForm(req, userId, existing);
  if ("error" in r) return r.error;
  const draft = await saveDraft(userId, id, r.d, r.kept, r.added);
  if (!draft) {
    await r.discard();
    return notFound();
  }
  return NextResponse.json({ draft: toDraft(draft) }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/mobile/drafts/:id  →  204
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/drafts/[id]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!(await deleteDraft(session.user.id, (await params).id.slice(0, 40)))) return notFound();
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
