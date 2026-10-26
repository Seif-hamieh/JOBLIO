import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { privacySchema } from "@/lib/validation/profile";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { updatePrivacySettings } from "@/server/services/settings";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// PUT /api/mobile/settings/privacy  { visibility: PUBLIC | MEMBERS | CONNECTIONS,
//                                     messagePermission: EVERYONE | RECRUITERS_AND_CONNECTIONS | CONNECTIONS,
//                                     searchableByRecruiters, privateBrowsing, showConnections }  →  { privacy }
// Who can see the profile and who can message the member: the website's Privacy settings, same rules.
export async function PUT(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  if (!rateLimit(`${LIMITS.write.key}:${session.user.id}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = privacySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Send every privacy setting.");
  const privacy = await updatePrivacySettings(session.user.id, parsed.data);
  // The public profile page reflects the new visibility straight away.
  const username = (session.user as { username?: string | null }).username;
  if (username) revalidatePath(`/in/${username}`);
  return NextResponse.json({ privacy }, { headers: { "Cache-Control": "no-store" } });
}
