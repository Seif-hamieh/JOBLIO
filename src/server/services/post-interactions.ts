import "server-only";
import { db } from "@/server/db";
import { notify } from "@/server/services/notifications";
import { isBlockedEitherWay, isConnected } from "@/server/services/profile";
import { k } from "@/i18n/message";

// Likes and comments on feed posts, shared by the website's feed (server actions) and the mobile API.

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } },
} as const;

/** The post if this member may see it (not blocked either way; connections-only posts need a connection). */
export async function canSeePost(viewerId: string, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, visibility: true, content: true } });
  if (!post) return null;
  if (await isBlockedEitherWay(viewerId, post.authorId)) return null;
  if (post.visibility === "CONNECTIONS" && !(await isConnected(viewerId, post.authorId))) return null;
  return post;
}

/**
 * Likes (or unlikes) a post the member can see; repeating the same request changes nothing. The author gets one
 * unread "liked your post" notification per post at most. Null when the post is gone or hidden from this member.
 */
export async function setPostLike(viewer: { id: string; name: string }, postId: string, like: boolean): Promise<{ liked: boolean; count: number } | null> {
  const post = await canSeePost(viewer.id, postId);
  if (!post) return null;
  const key = { postId_userId: { postId: post.id, userId: viewer.id } };
  const existing = await db.postLike.findUnique({ where: key });
  if (!!existing === like) {
    const { likeCount } = await db.post.findUniqueOrThrow({ where: { id: post.id }, select: { likeCount: true } });
    return { liked: like, count: likeCount };
  }
  const [, updated] = await db.$transaction([
    existing ? db.postLike.delete({ where: key }) : db.postLike.create({ data: { postId: post.id, userId: viewer.id } }),
    db.post.update({ where: { id: post.id }, data: { likeCount: { [existing ? "decrement" : "increment"]: 1 } }, select: { likeCount: true } }),
  ]);
  if (!existing) {
    // Coalesce: one unread like notification per post.
    const pendingLike = await db.notification.findFirst({ where: { userId: post.authorId, type: "POST_LIKE", readAt: null, href: `/feed/${post.id}` } });
    if (!pendingLike) {
      await notify({ userId: post.authorId, actorId: viewer.id, type: "POST_LIKE", title: k("notif.postLike", { name: viewer.name }), body: post.content.slice(0, 80), href: `/feed/${post.id}` });
    }
  }
  return { liked: like, count: updated.likeCount };
}

/** Adds a comment (already validated text) to a post the member can see and tells the author. Null if not visible. */
export async function addPostComment(viewer: { id: string; name: string }, postId: string, content: string) {
  const post = await canSeePost(viewer.id, postId);
  if (!post) return null;
  const [comment] = await db.$transaction([
    db.comment.create({ data: { postId: post.id, authorId: viewer.id, content }, select: commentSelect }),
    db.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } }),
  ]);
  await notify({ userId: post.authorId, actorId: viewer.id, type: "POST_COMMENT", title: k("notif.postComment", { name: viewer.name }), body: content.slice(0, 120), href: `/feed/${post.id}` });
  return comment;
}
