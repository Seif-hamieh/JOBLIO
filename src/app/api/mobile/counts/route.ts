import { NextResponse } from "next/server";
import { getCounts } from "@/server/services/counts";
import { getMobileSession, mobileError } from "@/server/mobile/auth";

export const dynamic = "force-dynamic";

// GET /api/mobile/counts  →  { notifications, messages, pendingConnections }
// The badge numbers. The app asks while it is open in the foreground (about twice a minute) and when it comes back
// from the background — a few small count queries, no long-lived connection.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  return NextResponse.json(await getCounts(session.user.id), { headers: { "Cache-Control": "private, no-store" } });
}
