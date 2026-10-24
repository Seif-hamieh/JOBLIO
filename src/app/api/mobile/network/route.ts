import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { connectionIds, networkStats, personCardSelect, suggestions } from "@/server/services/network";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPerson } from "@/server/mobile/network";
import { resolveMessage } from "@/i18n/message";
import { createT } from "@/i18n/translate";

export const dynamic = "force-dynamic";

// GET /api/mobile/network  →  { invitations, sent, connections, suggestions, stats }
// The website's My Network page: requests waiting for you, requests you sent, your connections (A→Z, up to 200)
// and people you may know (rule-based: mutual connections, skills, city, company).
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const ids = await connectionIds(userId);
  const [incoming, outgoing, people, pymk, stats] = await Promise.all([
    db.connection.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, message: true, createdAt: true, requester: { select: personCardSelect } },
    }),
    db.connection.findMany({
      where: { requesterId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, createdAt: true, addressee: { select: personCardSelect } },
    }),
    db.user.findMany({ where: { id: { in: ids } }, select: personCardSelect, orderBy: { name: "asc" }, take: 200 }),
    suggestions(userId, 10),
    networkStats(userId),
  ]);
  const en = createT("en");
  return NextResponse.json(
    {
      invitations: incoming.map((c) => ({ id: c.id, message: c.message, createdAt: c.createdAt.toISOString(), person: toPerson(c.requester) })),
      sent: outgoing.map((c) => ({ id: c.id, createdAt: c.createdAt.toISOString(), person: toPerson(c.addressee) })),
      connections: people.map(toPerson),
      suggestions: pymk.map((s) => ({ person: toPerson(s.user), reason: resolveMessage(en, s.reason), mutual: s.mutual })),
      stats,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
