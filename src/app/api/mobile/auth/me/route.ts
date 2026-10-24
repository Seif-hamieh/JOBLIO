import { NextResponse } from "next/server";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toMe } from "@/server/mobile/dto";

export const dynamic = "force-dynamic";

// GET /api/mobile/auth/me  (Authorization: Bearer <token>)  →  { user }
// The app calls this at start-up to check that its saved token still works.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  return NextResponse.json({ user: toMe(session.user) }, { headers: { "Cache-Control": "private, no-store" } });
}
