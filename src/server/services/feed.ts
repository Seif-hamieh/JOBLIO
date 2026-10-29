import "server-only";
import { db, type Prisma } from "@/server/db";
import { connectionIds } from "@/server/services/network";

const postInclude = {
  author: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } },
  company: { select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true } },
  job: {
    select: {
      id: true,
      title: true,
      workMode: true,
      city: true,
      countryCode: true,
      employmentType: true,
      status: true,
      company: { select: { name: true, logoUrl: true, brandColor: true } },
    },
  },
  project: { select: { id: true, title: true, summary: true, imageUrl: true, url: true, profile: { select: { user: { select: { username: true } } } } } },
  sharedPost: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      mediaUrls: true,
      mediaType: true,
      thumbnailUrl: true,
      author: { select: { name: true, image: true, username: true } },
      company: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.PostInclude;

export type FeedPost = Prisma.PostGetPayload<{ include: typeof postInclude }> & { liked: boolean };

export const FEED_PAGE = 10;

/**
 * Chronological, transparent feed: your posts, your connections, people and
 * companies you follow — then recent public posts so the feed is never empty.
 * Connection-only posts are only visible to connections. No ranking model.
 */
export async function getFeed(viewerId: string, opts: { cursor?: string; authorId?: string; companyId?: string; networkOnly?: boolean } = {}) {
  const [connections, follows, companyFollows, blocks] = await Promise.all([
    connectionIds(viewerId),
    db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    db.companyFollower.findMany({ where: { userId: viewerId }, select: { companyId: true } }),
    db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }),
  ]);
  const blocked = blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== viewerId);
  const connected = new Set([viewerId, ...connections]);

  const visibility: Prisma.PostWhereInput = { OR: [{ visibility: "PUBLIC" }, { authorId: { in: [...connected] } }] };
  let scope: Prisma.PostWhereInput;
  if (opts.authorId) scope = { authorId: opts.authorId, companyId: null };
  else if (opts.companyId) scope = { companyId: opts.companyId };
  else {
    scope = {
      OR: [
        { authorId: { in: [...connected, ...follows.map((f) => f.followingId)] } },
        { companyId: { in: companyFollows.map((c) => c.companyId) } },
        // "Everyone" also mixes in recent public posts; "My network" doesn't.
        ...(opts.networkOnly ? [] : [{ createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) }, visibility: "PUBLIC" as const }]),
      ],
    };
  }

  const posts = await db.post.findMany({
    where: { AND: [scope, visibility, { authorId: { notIn: blocked } }] },
    include: postInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: FEED_PAGE + 1,
    ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
  });
  const hasMore = posts.length > FEED_PAGE;
  const page = posts.slice(0, FEED_PAGE);
  const liked = new Set(
    (await db.postLike.findMany({ where: { userId: viewerId, postId: { in: page.map((p) => p.id) } }, select: { postId: true } })).map((l) => l.postId),
  );
  return { posts: page.map((p) => ({ ...p, liked: liked.has(p.id) })) as FeedPost[], nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

/** A single post for a viewer who has already passed the visibility checks. */
export async function getPost(viewerId: string, postId: string): Promise<FeedPost | null> {
  const [post, like] = await Promise.all([
    db.post.findUnique({ where: { id: postId }, include: postInclude }),
    db.postLike.findUnique({ where: { postId_userId: { postId, userId: viewerId } } }),
  ]);
  return post ? { ...post, liked: !!like } : null;
}

export async function getComments(postId: string) {
  return db.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } } },
  });
}

export type FeedComment = Awaited<ReturnType<typeof getComments>>[number];
