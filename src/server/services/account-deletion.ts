import "server-only";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/server/db";
import { deleteStored, storageDriver } from "@/server/storage";

/**
 * Every stored file of a member that goes away with their account: profile photo and cover, CV, project and
 * portfolio images, post and draft media (videos and still frames too), stories, article covers, the CV copies
 * sent with their applications and the files they sent in chat. Seed and external URLs are skipped by deleteStored.
 */
async function accountFiles(userId: string) {
  const [user, profile, posts, drafts, stories, articles, applications, messages] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { image: true } }),
    db.profile.findUnique({
      where: { userId },
      select: { coverUrl: true, resumeUrl: true, projects: { select: { imageUrl: true } }, portfolioItems: { select: { url: true, thumbnailUrl: true } } },
    }),
    db.post.findMany({ where: { authorId: userId }, select: { mediaUrls: true, thumbnailUrl: true } }),
    db.postDraft.findMany({ where: { authorId: userId }, select: { mediaUrls: true } }),
    db.story.findMany({ where: { userId }, select: { mediaUrl: true, thumbnailUrl: true } }),
    db.article.findMany({ where: { authorId: userId }, select: { coverImage: true } }),
    db.application.findMany({ where: { applicantId: userId }, select: { resumeUrl: true } }),
    db.message.findMany({ where: { senderId: userId, attachmentUrl: { not: null } }, select: { attachmentUrl: true } }),
  ]);
  return [
    user?.image,
    profile?.coverUrl,
    profile?.resumeUrl,
    ...(profile?.projects.map((p) => p.imageUrl) ?? []),
    ...(profile?.portfolioItems.flatMap((p) => [p.url, p.thumbnailUrl]) ?? []),
    ...posts.flatMap((p) => [...p.mediaUrls, p.thumbnailUrl]),
    ...drafts.flatMap((d) => d.mediaUrls),
    ...stories.flatMap((s) => [s.mediaUrl, s.thumbnailUrl]),
    ...articles.map((a) => a.coverImage),
    ...applications.map((a) => a.resumeUrl),
    ...messages.map((m) => m.attachmentUrl),
  ];
}

/**
 * Permanently deletes a member's account and then their files from storage (used by the website's Settings and
 * the app). Jobs and interviews a recruiter created belong to their company, so they are handed to another company
 * admin first; returns "blocked" when there is none (a sole owner must hand over or delete the workspace first).
 */
export async function deleteAccount(userId: string, companyId: string | null): Promise<"deleted" | "blocked"> {
  const [jobs, interviews] = await Promise.all([db.job.count({ where: { postedById: userId } }), db.interview.count({ where: { scheduledById: userId } })]);
  if (jobs || interviews) {
    const heir = companyId
      ? await db.companyMember.findFirst({ where: { companyId, userId: { not: userId }, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } })
      : null;
    if (!heir) return "blocked";
    await db.$transaction([
      db.job.updateMany({ where: { postedById: userId }, data: { postedById: heir.userId } }),
      db.interview.updateMany({ where: { scheduledById: userId }, data: { scheduledById: heir.userId } }),
    ]);
  }
  const files = await accountFiles(userId);
  await db.user.delete({ where: { id: userId } });
  // Files only after the account is gone: a failed delete above must not leave a live account without its files.
  await deleteStored(files);
  // And whatever is left in the member's own folders (an upload that was never attached to anything).
  if (storageDriver() === "local") {
    const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (safe) {
      for (const dir of ["public/media", "private/resume"]) await rm(join(process.cwd(), "storage", dir, safe), { recursive: true, force: true }).catch(() => {});
    }
  }
  return "deleted";
}
