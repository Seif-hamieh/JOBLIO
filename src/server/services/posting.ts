import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { extractHashtags } from "@/lib/hashtags";
import { deleteStored } from "@/server/storage";

// Writing a post: the fields, the checks on what's attached, and creating it. Shared by the website's composer,
// publishing a draft (website and app) and the app, so every way of posting follows the same rules.

export const postSchema = z.object({
  content: z.string().trim().min(1, "@v.writeSomething").max(3000, "@v.postLength"),
  type: z.enum(["UPDATE", "PROJECT", "ACHIEVEMENT", "JOB"]),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]),
  asCompany: z.enum(["1", "0"]).optional(),
  jobId: z.string().max(40).optional().transform((v) => v || null),
  projectId: z.string().max(40).optional().transform((v) => v || null),
});
export type PostFields = z.infer<typeof postSchema>;

/** Who is posting: enough to check what they may attach and whether they may speak for their company. */
export type Author = { id: string; profileId: string | null; company: { id: string; role: string } | null };

/** The author of an app request (the app sends only the token): their profile and their first company membership. */
export async function authorFor(userId: string): Promise<Author> {
  const [profile, member] = await Promise.all([
    db.profile.findUnique({ where: { userId }, select: { id: true } }),
    db.companyMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { companyId: true, role: true } }),
  ]);
  return { id: userId, profileId: profile?.id ?? null, company: member ? { id: member.companyId, role: member.role } : null };
}

/**
 * Why this post can't be published (a message key), or null. Attached jobs must be the author's company's open
 * jobs, attached projects the author's own, and only the company's owners and admins may post as the company.
 */
export async function postingProblem(author: Author, d: Pick<PostFields, "asCompany" | "jobId" | "projectId">) {
  if (d.jobId) {
    const job = await db.job.findUnique({ where: { id: d.jobId }, select: { companyId: true, status: true } });
    if (!job || job.companyId !== author.company?.id || job.status !== "OPEN") return "@msg.shareOwnJobs";
  }
  if (d.projectId) {
    const project = await db.project.findUnique({ where: { id: d.projectId }, select: { profileId: true } });
    if (!project || project.profileId !== author.profileId) return "@msg.projectNotFound";
  }
  if (d.asCompany === "1" && !(author.company && (author.company.role === "OWNER" || author.company.role === "ADMIN"))) {
    return "@msg.companyPostAdminsOnly";
  }
  return null;
}

/**
 * Deletes one of the member's own posts, then its photos or video and still frame from storage. False when it isn't
 * theirs or no longer exists. Reposts of it stay, without the original (they point to nothing).
 */
export async function deleteOwnPost(userId: string, postId: string) {
  const post = await db.post.findFirst({ where: { id: postId, authorId: userId }, select: { id: true, mediaUrls: true, thumbnailUrl: true } });
  if (!post) return false;
  await db.post.delete({ where: { id: post.id } });
  await deleteStored([...post.mediaUrls, post.thumbnailUrl]);
  return true;
}

/** Creates the post (after postingProblem said yes). With `video` (checked by videoMedia), mediaUrls is just the video. */
export async function createPost(author: Author, d: PostFields, mediaUrls: string[], video?: { thumbnailUrl: string | null }) {
  return db.post.create({
    data: {
      authorId: author.id,
      companyId: d.asCompany === "1" ? author.company!.id : null,
      content: d.content,
      hashtags: extractHashtags(d.content),
      type: d.jobId ? "JOB" : d.projectId ? "PROJECT" : d.type === "JOB" ? "UPDATE" : d.type,
      visibility: d.visibility,
      jobId: d.jobId,
      projectId: d.projectId,
      mediaUrls,
      ...(video && { mediaType: "VIDEO" as const, thumbnailUrl: video.thumbnailUrl }),
    },
    select: { id: true },
  });
}
