import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { checkAchievements } from "@/server/services/achievements";
import { fullProfileSelect } from "@/server/services/profile-page";
import { saveBasics } from "@/server/services/profile-editing";
import { getMobileOwner, mobileError, parseMobile } from "@/server/mobile/auth";
import { allAchievements, toProfile } from "@/server/mobile/profile";
import { basicsSchema } from "@/lib/validation/profile";

export const dynamic = "force-dynamic";

async function myProfile(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: fullProfileSelect });
  return user && { ...toProfile(user), allAchievements: allAchievements(user.achievements) };
}

// GET /api/mobile/me/profile  →  { profile }
// Your own profile with everything the edit screens need, plus every achievement (earned or not). Like the
// website's Achievements page, achievements are re-checked first.
export async function GET(req: Request) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  await checkAchievements(r.owner.id).catch(() => undefined);
  return NextResponse.json({ profile: await myProfile(r.owner.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

// PATCH /api/mobile/me/profile  { name, headline, about, pronouns, city, countryCode, website }  →  { profile }
// The website's "Edit intro" form: same fields, same limits.
export async function PATCH(req: Request) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`${LIMITS.write.key}:${r.owner.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = parseMobile(basicsSchema, await req.json().catch(() => null));
  if ("error" in parsed) return parsed.error;
  await saveBasics(r.owner, parsed.data);
  return NextResponse.json({ profile: await myProfile(r.owner.id) }, { headers: { "Cache-Control": "no-store" } });
}
