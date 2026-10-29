"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionFailure, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { getComments, getFeed, type FeedComment, type FeedPost } from "@/server/services/feed";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { addPostComment, canSeePost, repostPost, setPostLike } from "@/server/services/post-interactions";
import { createPost, postingProblem, postSchema } from "@/server/services/posting";
import { deleteDraft, draftSchema, MAX_DRAFT_MEDIA, publishDraft, saveDraft } from "@/server/services/post-drafts";

const id = z.string().min(1).max(40);

const postFields = (form: FormData) => ({
  content: form.get("content") ?? "",
  type: form.get("type") ?? "UPDATE",
  visibility: form.get("visibility") ?? "PUBLIC",
  asCompany: form.get("asCompany") ?? undefined,
  jobId: form.get("jobId") ?? undefined,
  projectId: form.get("projectId") ?? undefined,
});

/** Stores the newly picked images (form "media"), at most `room` of them. */
async function uploadMedia(form: FormData, userId: string, room: number): Promise<string[] | ActionFailure> {
  const files = form.getAll("media").filter((f): f is File => f instanceof File && f.size > 0).slice(0, Math.max(0, room));
  const urls: string[] = [];
  try {
    for (const f of files) urls.push((await storeUpload(f, "post", userId)).url);
  } catch (e) {
    await deleteStored(urls);
    if (e instanceof UploadError) return fail(e.message);
    throw e;
  }
  return urls;
}

const keptMedia = (form: FormData) => form.getAll("keepMedia").filter((v): v is string => typeof v === "string");
const draftIdOf = (form: FormData) => {
  const v = form.get("draftId");
  return typeof v === "string" && v ? id.parse(v) : null;
};

/** Posts from the composer; with a "draftId" it publishes that draft (its kept images plus new ones). */
export async function createPostAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return withViewer({ limit: LIMITS.post }, async (viewer) => {
    const parsed = parse(postSchema, postFields(form));
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const problem = await postingProblem(viewer, d);
    if (problem) return fail(problem);

    const draftId = draftIdOf(form);
    const kept = keptMedia(form);
    const added = await uploadMedia(form, viewer.id, MAX_DRAFT_MEDIA - (draftId ? kept.length : 0));
    if (!Array.isArray(added)) return added;

    if (draftId) {
      const result = await publishDraft(viewer, draftId, d, kept, added);
      if ("problem" in result) {
        await deleteStored(added);
        return fail(result.problem);
      }
      revalidatePath("/feed/drafts");
    } else {
      await createPost(viewer, d, added);
    }
    revalidatePath("/feed");
    revalidatePath("/home");
    return { ok: true, message: "@msg.posted" };
  });
}

/** Saves the composer as a draft (new, or the one in "draftId"). */
export async function saveDraftAction(_prev: ActionState<{ id: string }>, form: FormData): Promise<ActionState<{ id: string }>> {
  return withViewer<{ id: string }>({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(draftSchema, postFields(form));
    if (!parsed.success) return parsed.state;
    const draftId = draftIdOf(form);
    const kept = keptMedia(form);
    const added = await uploadMedia(form, viewer.id, MAX_DRAFT_MEDIA - (draftId ? kept.length : 0));
    if (!Array.isArray(added)) return added;
    const saved = await saveDraft(viewer.id, draftId, parsed.data, kept, added);
    if (!saved) {
      await deleteStored(added);
      return fail(draftId ? "@msg.draftNotFound" : "@msg.tooManyDrafts");
    }
    revalidatePath("/feed/drafts");
    return { ok: true, message: "@msg.draftSaved", data: { id: saved.id } };
  });
}

export async function deleteDraftAction(draftId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    if (!(await deleteDraft(viewer.id, id.parse(draftId)))) return fail("@msg.draftNotFound");
    revalidatePath("/feed/drafts");
    return { ok: true, message: "@msg.draftDeleted" };
  });
}

export async function toggleLikeAction(postId: string): Promise<ActionState<{ liked: boolean; count: number }>> {
  return withViewer<{ liked: boolean; count: number }>({ limit: LIMITS.like }, async (viewer) => {
    const pid = id.parse(postId);
    const existing = await db.postLike.findUnique({ where: { postId_userId: { postId: pid, userId: viewer.id } }, select: { postId: true } });
    const result = await setPostLike(viewer, pid, !existing);
    if (!result) return fail("@msg.postNotFound");
    return { ok: true, data: result };
  });
}

export async function addCommentAction(postId: string, content: string): Promise<ActionState<{ comment: FeedComment }>> {
  return withViewer<{ comment: FeedComment }>({ limit: LIMITS.comment }, async (viewer) => {
    const text = z.string().trim().min(1, "@v.writeComment").max(1500).safeParse(content);
    if (!text.success) return fail(text.error.issues[0]?.message ?? "@v.writeComment");
    const comment = await addPostComment(viewer, id.parse(postId), text.data);
    if (!comment) return fail("@msg.postNotFound");
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
    const text = z.string().max(3000).parse(content ?? "");
    if (!(await repostPost(viewer, id.parse(postId), text))) return fail("@msg.postNotFound");
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
