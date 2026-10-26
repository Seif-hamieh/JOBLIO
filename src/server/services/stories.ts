import "server-only";
import { db } from "@/server/db";
import { connectionIds } from "@/server/services/network";

/** How long a story stays up. */
export const STORY_TTL_MS = 24 * 60 * 60_000;
export const STORY_TEXT_MAX = 250;

const authorSelect = { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } as const;

/**
 * Whose stories a member sees: their own, their connections' and the people they follow — never strangers' (unlike
 * the feed, stories don't mix in public posts). Members they blocked or who blocked them are left out.
 */
async function storyAudience(viewerId: string) {
  const [connections, follows, blocks] = await Promise.all([
    connectionIds(viewerId),
    db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }),
  ]);
  const blocked = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== viewerId));
  return [...new Set([viewerId, ...connections, ...follows.map((f) => f.followingId)])].filter((id) => !blocked.has(id));
}

/** Live stories from a set of members: not expired, and their author isn't banned. */
const liveFrom = (userIds: string[], now: Date) => ({ userId: { in: userIds }, expiresAt: { gt: now }, user: { bannedAt: null } });

export async function createStory(userId: string, mediaUrl: string, text: string | null) {
  return db.story.create({
    data: { userId, mediaUrl, text, expiresAt: new Date(Date.now() + STORY_TTL_MS) },
    select: { id: true, mediaUrl: true, text: true, createdAt: true, expiresAt: true },
  });
}

/**
 * The live stories a member can see, one group per author: your own first, then authors with stories you haven't
 * seen (newest first), then the ones you've seen all of. Inside a group stories are in posting order, the order they
 * play in. `seen` is per story; the view count is only included on your own stories.
 */
export async function listStories(viewerId: string) {
  const now = new Date();
  const audience = await storyAudience(viewerId);
  const stories = await db.story.findMany({
    where: liveFrom(audience, now),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      mediaUrl: true,
      text: true,
      createdAt: true,
      expiresAt: true,
      user: { select: authorSelect },
      views: { where: { viewerId }, select: { id: true } },
      _count: { select: { views: true } },
    },
  });

  const groups = new Map<string, { user: (typeof stories)[number]["user"]; mine: boolean; stories: typeof stories }>();
  for (const s of stories) {
    const g = groups.get(s.userId) ?? { user: s.user, mine: s.userId === viewerId, stories: [] };
    g.stories.push(s);
    groups.set(s.userId, g);
  }

  return [...groups.values()]
    .map((g) => {
      const items = g.stories.map((s) => ({
        id: s.id,
        mediaUrl: s.mediaUrl,
        text: s.text,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        // Your own stories count as seen: they never light the "new" ring for you.
        seen: g.mine || s.views.length > 0,
        viewCount: g.mine ? s._count.views : null,
      }));
      return {
        user: { id: g.user.id, name: g.user.name, image: g.user.image, username: g.user.username, headline: g.user.profile?.headline ?? null },
        mine: g.mine,
        hasUnseen: items.some((s) => !s.seen),
        latestAt: items[items.length - 1]!.createdAt,
        stories: items,
      };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.hasUnseen) - Number(a.hasUnseen) || b.latestAt.getTime() - a.latestAt.getTime());
}

/**
 * Records that a member saw a story (once: seeing it again changes nothing). Returns false when the story doesn't
 * exist for them — expired, deleted, or not from someone in their audience. Your own stories aren't counted.
 */
export async function markStoryViewed(viewerId: string, storyId: string) {
  const story = await db.story.findFirst({ where: { id: storyId, expiresAt: { gt: new Date() }, user: { bannedAt: null } }, select: { userId: true } });
  if (!story) return false;
  if (story.userId === viewerId) return true;
  if (!(await storyAudience(viewerId)).includes(story.userId)) return false;
  await db.storyView.createMany({ data: [{ storyId, viewerId }], skipDuplicates: true });
  return true;
}
