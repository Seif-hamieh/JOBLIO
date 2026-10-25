import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { completeOnboardingFor } from "@/server/services/onboarding";
import { actionErrorResponse, getMobileOwner, mobileError, parseMobile } from "@/server/mobile/auth";
import { memberCompany, toMe } from "@/server/mobile/dto";
import { db } from "@/server/db";
import { onboardingSchema } from "@/lib/validation/profile";

export const dynamic = "force-dynamic";

// POST /api/mobile/me/onboarding  { intent, headline, city?, countryCode?, skills: [{ skillId, level }], company? }
//   →  { user }
// The website's welcome setup: what you're here for, your headline and place, first skills, and — when hiring — your
// company. Marks the account as set up. Same rules and limit (10 a minute) as the website.
export async function POST(req: Request) {
  const r = await getMobileOwner(req);
  if ("error" in r) return r.error;
  if (!rateLimit(`onboarding:${r.owner.id}`, 10, 60_000).ok) return mobileError(429, "RATE_LIMITED", "Too many attempts. Try again in a minute.");
  const parsed = parseMobile(onboardingSchema, await req.json().catch(() => null));
  if ("error" in parsed) return parsed.error;
  const company = await memberCompany(r.owner.id);
  try {
    await completeOnboardingFor({ id: r.owner.id, profileId: r.owner.profileId, hasCompany: !!company }, parsed.data);
  } catch (e) {
    const refused = actionErrorResponse(e);
    if (refused) return refused;
    throw e;
  }
  const user = await db.user.findUniqueOrThrow({
    where: { id: r.owner.id },
    select: { id: true, name: true, email: true, image: true, username: true, intent: true, onboardedAt: true, emailVerified: true, platformRole: true },
  });
  return NextResponse.json({ user: toMe(user, await memberCompany(r.owner.id)) }, { headers: { "Cache-Control": "no-store" } });
}
