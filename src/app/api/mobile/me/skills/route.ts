import { NextResponse } from "next/server";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { addSkill } from "@/server/services/profile-editing";
import { actionErrorResponse, getMobileOwner, mobileError, parseMobile } from "@/server/mobile/auth";
import { skillEntrySchema } from "@/lib/validation/profile";

export const dynamic = "force-dynamic";

// POST /api/mobile/me/skills  { skillId, level }  →  201 { id }
// Adds a skill from the website's skill list (search it with /api/v1/skills), up to 50.
export async function POST(req: Request) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = parseMobile(skillEntrySchema, await req.json().catch(() => null));
  if ("error" in parsed) return parsed.error;
  try {
    const id = await addSkill(r.owner, parsed.data);
    return NextResponse.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
}
