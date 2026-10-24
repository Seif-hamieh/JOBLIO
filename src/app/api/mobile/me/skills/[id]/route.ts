import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { removeSkill, updateSkill } from "@/server/services/profile-editing";
import { actionErrorResponse, getMobileOwner, mobileError, parseMobile } from "@/server/mobile/auth";
import { skillUpdateSchema } from "@/lib/validation/profile";

export const dynamic = "force-dynamic";

// PATCH /api/mobile/me/skills/:id  { level?, years?, isTop? }  →  { ok: true }
// Changes a skill's level, years, or whether it is one of your 3 top skills.
export async function PATCH(req: Request, { params }: RouteContext<"/api/mobile/me/skills/[id]">) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = parseMobile(skillUpdateSchema, await req.json().catch(() => null));
  if ("error" in parsed) return parsed.error;
  const { id } = await params;
  try {
    await updateSkill(r.owner, id.slice(0, 40), parsed.data);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}

// DELETE /api/mobile/me/skills/:id  →  { ok: true }
export async function DELETE(req: Request, { params }: RouteContext<"/api/mobile/me/skills/[id]">) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const { id } = await params;
  await removeSkill(r.owner, id.slice(0, 40));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
