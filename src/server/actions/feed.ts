"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { notify } from "@/server/services/notifications";
import { k } from "@/i18n/message";
import { getComments, getFeed, type FeedComment, type FeedPost } from "@/server/services/feed";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { isBlockedEitherWay, isConnected } from "@/server/services/profile";
import { canManageCompany } from "@/server/session";

const id = z.string().min(1).max(40);

const postSchema = z.object({
  content: z.string().trim().min(1, "@v.writeSomething").max(3000, "@v.postLength"),
  type: z.enum(["UPDATE", "PROJECT", "ACHIEVEMENT", "JOB"]),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]),
  asCompany: z.enum(["1", "0"]).optional(),
  jobId: z.string().max(40).optional().transform((v) => v || null),
  projectId: z.string().max(40).optional().transform((v) => v || null),
});

export async function createPostAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return withViewer({ limit: LIMITS.post }, async (viewer) => {
    const parsed = parse(postSchema, {
      content: form.get("content"),
      type: form.get("type") ?? "UPDATE",
      visibility: form.get("visibility") ?? "PUBLIC",
      asCompany: form.get("asCompany") ?? undefined,
      jobId: form.get("jobId") ?? undefined,
      projectId: form.get("projectId") ?? undefined,
    });
    if (!parsed.success) return parsed.state;
    const d = parsed.data;

    // Attached entities must belong to the author.
    if (d.jobId) {
      const job = await db.job.findUnique({ where: { id: d.jobId }, select: { companyId: true, status: true } });
      if (!job || job.companyId !== viewer.company?.id || job.status !== "OPEN") return fail("@msg.shareOwnJobs");
    }
    if (d.projectId) {
      const project = await db.project.findUnique({ where: { id: d.projectId }, select: { profileId: true } });
      if (!project || project.profileId !== viewer.profileId) return fail("@msg.projectNotFound");
    }
    // Only the company's owners and admins may speak for it; the composer hides the option for others,
    // and a crafted request is refused here rather than silently posted under the member's own name.
    let asCompany: string | null = null;
    if (d.asCompany === "1") {
      if (!viewer.company || !canManageCompany(viewer, viewer.company.id)) return fail("@msg.companyPostAdminsOnly");
      asCompany = viewer.company.id;
    }

    const files = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
    const mediaUrls: string[] = [];
    try {
      for (const f of files) mediaUrls.push((await storeUpload(f, "post", viewer.id)).url);
    } catch (e) {
      if (e instanceof UploadError) return fail(e.message);
      throw e;
    }

    await db.post.create({
      data: {
        authorId: viewer.id,
        companyId: asCompany,
        content: d.content,
        type: d.jobId ? "JOB" : d.projectId ? "PROJECT" : d.type === "JOB" ? "UPDATE" : d.type,
        visibility: d.visibility,
        jobId: d.jobId,
        projectId: d.projectId,
        mediaUrls,
      },
    });
    revalidatePath("/feed");
    revalidatePath("/home");
    return { ok: true, message: "@msg.posted" };
  });
}

async function canSeePost(viewerId: string, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, visibility: true, content: true } });
  if (!post) return null;
  if (await isBlockedEitherWay(viewerId, post.authorId)) return null;
  if (post.visibility === "CONNECTIONS" && !(await isConnected(viewerId, post.authorId))) return null;
  return post;
}

export async function toggleLikeAction(postId: string): Promise<ActionState<{ liked: boolean; count: number }>> {
  return withViewer<{ liked: boolean; count: number }>({ limit: LIMITS.like }, async (viewer) => {
    const post = await canSeePost(viewer.id, id.parse(postId));
    if (!post) return fail("@msg.postNotFound");
    const key = { postId_userId: { postId: post.id, userId: viewer.id } };
    const existing = await db.postLike.findUnique({ where: key });
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
    return { ok: true, data: { liked: !existing, count: updated.likeCount } };
  });
}

export async function addCommentAction(postId: string, content: string): Promise<ActionState<{ comment: FeedComment }>> {
  return withViewer<{ comment: FeedComment }>({ limit: LIMITS.comment }, async (viewer) => {
    const text = z.string().trim().min(1, "@v.writeComment").max(1500).safeParse(content);
    if (!text.success) return fail(text.error.issues[0]?.message ?? "@v.writeComment");
    const post = await canSeePost(viewer.id, id.parse(postId));
    if (!post) return fail("@msg.postNotFound");
    const [comment] = await db.$transaction([
      db.comment.create({
        data: { postId: post.id, authorId: viewer.id, content: text.data },
        select: { id: true, content: true, createdAt: true, author: { select: { id: true, name: true, image: true, username: true, profile: { select: { headline: true } } } } },
      }),
      db.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } }),
    ]);
    await notify({ userId: post.authorId, actorId: viewer.id, type: "POST_COMMENT", title: k("notif.postComment", { name: viewer.name }), body: text.data.slice(0, 120), href: `/feed/${post.id}` });
    return { ok: true, data: { comment } };
  });
}

export async function loadCommentsAction(postId: string): Promise<FeedComment[]> {
  const res = await withViewer<FeedComment[]>({}, async (viewer) => {
    const post = await canSeePost(viewer.id, id.parse(postId));
    if (!post) return fail("@msg.postNotFound");
    return { ok: true, data: await getComments(post.id) };
  });
  return res?.ok ? (res.data ?? []) : [];
}

export async function deleteCommentAction(commentId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const c = await db.comment.findUnique({ where: { id: id.parse(commentId) }, select: { id: true, authorId: true, postId: true, post: { select: { authorId: true } } } });
    if (!c || (c.authorId !== viewer.id && c.post.authorId !== viewer.id)) return fail("@msg.commentNotFound");
    await db.$transaction([db.comment.delete({ where: { id: c.id } }), db.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } })]);
    return { ok: true };
  });
}

export async function sharePostAction(postId: string, content: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.post }, async (viewer) => {
    const post = await canSeePost(viewer.id, id.parse(postId));
    if (!post) return fail("@msg.postNotFound");
    const text = z.string().trim().max(3000).parse(content ?? "");
    await db.$transaction([
      db.post.create({ data: { authorId: viewer.id, content: text, sharedPostId: post.id, visibility: "PUBLIC" } }),
      db.post.update({ where: { id: post.id }, data: { shareCount: { increment: 1 } } }),
    ]);
    await notify({ userId: post.authorId, actorId: viewer.id, type: "POST_SHARE", title: k("notif.postShare", { name: viewer.name }), href: `/feed/${post.id}` });
    revalidatePath("/feed");
    return { ok: true, message: "@msg.shared" };
  });
}

export async function deletePostAction(postId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const post = await db.post.findFirst({ where: { id: id.parse(postId), authorId: viewer.id }, select: { id: true, mediaUrls: true } });
    if (!post) return fail("@msg.postNotFound");
    await db.post.delete({ where: { id: post.id } });
    await deleteStored(post.mediaUrls);
    revalidatePath("/feed");
    return { ok: true, message: "@msg.postDeleted" };
  });
}

export async function loadMoreFeedAction(cursor: string, scope?: { authorId?: string; companyId?: string; networkOnly?: boolean }): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const res = await withViewer<{ posts: FeedPost[]; nextCursor: string | null }>({ limit: LIMITS.search }, async (viewer) => ({
    ok: true,
    data: await getFeed(viewer.id, { cursor: id.parse(cursor), authorId: scope?.authorId, companyId: scope?.companyId, networkOnly: scope?.networkOnly === true }),
  }));
  return res?.ok && res.data ? res.data : { posts: [], nextCursor: null };
}
