import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { personCardSelect, relationStates } from "@/server/services/network";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPerson } from "@/server/mobile/network";

export const dynamic = "force-dynamic";

// GET /api/mobile/professionals  →  { people: [{ person, relation }] }
// The website's Featured professionals: members currently boosting their profile (most recent first), with your
// connection state for each. Never yourself, never anyone you blocked or who blocked you.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const viewerId = session.user.id;
  const people = await db.user.findMany({
    where: {
      id: { not: viewerId },
      profile: { featuredUntil: { gt: new Date() }, visibility: { in: ["PUBLIC", "MEMBERS"] } },
      blocksMade: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
    },
    select: personCardSelect,
    orderBy: { profile: { featuredUntil: "desc" } },
    take: 48,
  });
  const relations = await relationStates(viewerId, people.map((p) => p.id));
  return NextResponse.json(
    { people: people.map((p) => ({ person: toPerson(p), relation: relations.get(p.id)?.state ?? "none" })) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
