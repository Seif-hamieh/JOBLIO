import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { deleteStored } from "@/server/storage";
import { createPost, postingProblem, postSchema, type Author } from "@/server/services/posting";

// Post drafts (post_drafts), shared by the website's composer and the app. A draft can be saved half-written (even
// empty text); publishing runs the same checks as posting directly, creates the post with the draft's images and
// deletes the draft.

export const MAX_DRAFTS = 50;
export const MAX_DRAFT_MEDIA = 4;

/** A draft's fields: like a post's, but the text may still be empty. */
export const draftSchema = postSchema.extend({ content: z.string().trim().max(3000, "@v.postLength") });
export type DraftFields = z.infer<typeof draftSchema>;

const draftSelect = { id: true, content: true, type: true, visibility: true, asCompany: true, jobId: true, projectId: true, mediaUrls: true, createdAt: true, updatedAt: true } as const;

export async function listDrafts(userId: string) {
  return db.postDraft.findMany({ where: { authorId: userId }, orderBy: { updatedAt: "desc" }, select: draftSelect });
}

export async function getDraft(userId: string, id: string) {
  return db.postDraft.findFirst({ where: { id, authorId: userId }, select: draftSelect });
}

const toData = (d: DraftFields, mediaUrls: string[]) => ({
  content: d.content,
  type: d.type,
  visibility: d.visibility,
  asCompany: d.asCompany === "1",
  jobId: d.jobId,
  projectId: d.projectId,
  mediaUrls: mediaUrls.slice(0, MAX_DRAFT_MEDIA),
});

/**
 * Creates a draft, or updates one of the member's own (`id`). Images: the draft's own images the editor kept (`kept`
 * — anything not already on this draft is ignored, so no one can attach another member's file) plus newly uploaded
 * ones (`added`); images left out are deleted. Null: too many drafts already, or that draft doesn't exist.
 */
export async function saveDraft(userId: string, id: string | null, d: DraftFields, kept: string[], added: string[]) {
  if (!id) {
    if ((await db.postDraft.count({ where: { authorId: userId } })) >= MAX_DRAFTS) return null;
    return db.postDraft.create({ data: { authorId: userId, ...toData(d, added) }, select: draftSelect });
  }
  const existing = await getDraft(userId, id);
  if (!existing) return null;
  const mediaUrls = [...existing.mediaUrls.filter((u) => kept.includes(u)), ...added];
  const saved = await db.postDraft.update({ where: { id }, data: toData(d, mediaUrls), select: draftSelect });
  await deleteStored(existing.mediaUrls.filter((u) => !saved.mediaUrls.includes(u)));
  return saved;
}

export async function deleteDraft(userId: string, id: string) {
  const existing = await getDraft(userId, id);
  if (!existing) return false;
  await db.postDraft.delete({ where: { id } });
  await deleteStored(existing.mediaUrls);
  return true;
}

/**
 * Publishes a draft with its latest fields (the editor may have changed them) and images: the same checks as posting
 * directly (images as in saveDraft). Returns the new post's id, or a message key saying why it can't be published yet.
 */
export async function publishDraft(author: Author, id: string, d: DraftFields, kept: string[], added: string[]): Promise<{ postId: string } | { problem: string }> {
  const existing = await getDraft(author.id, id);
  if (!existing) return { problem: "@msg.postNotFound" };
  const mediaUrls = [...existing.mediaUrls.filter((u) => kept.includes(u)), ...added];
  const ready = postSchema.safeParse({ ...d, asCompany: d.asCompany ?? undefined, jobId: d.jobId ?? undefined, projectId: d.projectId ?? undefined });
  if (!ready.success) return { problem: ready.error.issues[0]?.message ?? "@v.writeSomething" };
  const problem = await postingProblem(author, ready.data);
  if (problem) return { problem };
  const media = mediaUrls.slice(0, MAX_DRAFT_MEDIA);
  const post = await createPost(author, ready.data, media);
  // The images now belong to the post: drop the draft row only, and any image the editor removed.
  await db.postDraft.delete({ where: { id } });
  await deleteStored(existing.mediaUrls.filter((u) => !media.includes(u)));
  return { postId: post.id };
}
