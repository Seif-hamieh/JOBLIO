import { NextResponse } from "next/server";
import { myPremiumFeatures } from "@/server/services/premium";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/settings/premium  →  { features: [{ product, until, gift, renews }], priorityCredits }
// The member's premium features now (Settings → My premium features): each plan or boost with its end date, whether
// the Joblio team gave it, and Priority Application credits left.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const p = await myPremiumFeatures(session.user.id);
  return NextResponse.json(
    { features: p.features.map((f) => ({ ...f, until: f.until.toISOString() })), priorityCredits: p.priorityCredits },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
