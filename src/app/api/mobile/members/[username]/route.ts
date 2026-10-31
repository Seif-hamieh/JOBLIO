import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { isPremiumUser } from "@/server/services/premium";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getFeed } from "@/server/services/feed";
import { relationStates } from "@/server/services/network";
import { canMessageUser } from "@/server/services/profile";
import { getProfilePage, recordProfileView } from "@/server/services/profile-page";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toPost } from "@/server/mobile/feed";
import { toProfile } from "@/server/mobile/profile";

export const dynamic = "force-dynamic";

// GET /api/mobile/members/:username  →  { status: "ok", profile, relation, canMessage, connections, posts }
//                                     or { status: "private", profile: { name, image, headline } }
// A member's profile page, with the same privacy rules as the website (visibility, blocks). Opening it counts as a
// profile view (once a day per viewer; private browsing stays anonymous), as on the website.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/members/[username]">) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const viewerId = session.user.id;
  if (!rateLimit(`${LIMITS.search.key}:${viewerId}`, LIMITS.search.max, LIMITS.search.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Too many requests. Try again in a minute.");
  const { username } = await params;
  const page = await getProfilePage(decodeURIComponent(username).slice(0, 40), viewerId);
  if (page.status === "not-found") return mobileError(404, "NOT_FOUND", "This member doesn't exist.");
  if (page.status === "private") {
    return NextResponse.json({ status: "private", profile: { name: page.user.name, image: page.user.image, headline: page.user.headline } }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const user = page.user;
  const self = user.id === viewerId;
  const membership = self ? null : await db.companyMember.findFirst({ where: { userId: viewerId }, orderBy: { createdAt: "asc" }, select: { company: { select: { id: true, name: true } } } });
  const [relations, canMessage, connections, feed, premium] = await Promise.all([
    relationStates(viewerId, [user.id]),
    self ? false : canMessageUser({ id: viewerId, isRecruiter: !!membership }, user.id),
    user.profile!.showConnections || self ? db.connection.count({ where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] } }) : null,
    getFeed(viewerId, { authorId: user.id }),
    self ? null : recordProfileView(user.id, { id: viewerId, name: session.user.name, company: membership?.company ?? null }),
    isPremiumUser(user.id),
  ]);
  const relation = relations.get(user.id) ?? { state: "none" };
  return NextResponse.json(
    {
      status: "ok",
      profile: toProfile(user),
      // Show the 👑 next to their name.
      premium,
      relation: { state: relation.state, connectionId: relation.connectionId ?? null },
      canMessage,
      connections,
      posts: feed.posts.slice(0, 5).map((p) => toPost(p, viewerId)),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
