import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { canSeePost } from "@/server/services/post-interactions";

// "Report post", shared by the website's feed and the mobile API. Only signed-in members can report, only posts
// they can see, never their own; a second report of the same post while the first is open just confirms it.

export const POST_REPORT_REASONS = ["SPAM", "SCAM", "HARASSMENT", "HATE", "INAPPROPRIATE", "MISINFORMATION", "OTHER"] as const;

export const postReportSchema = z.object({
  postId: z.string().min(1).max(40),
  reason: z.enum(POST_REPORT_REASONS),
  details: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
});

export async function reportPost(reporterId: string, input: z.output<typeof postReportSchema>) {
  const post = await canSeePost(reporterId, input.postId);
  if (!post) throw new ActionError("@msg.postNotFound");
  if (post.authorId === reporterId) throw new ActionError("@msg.reportOwnPost");
  const existing = await db.postReport.findFirst({ where: { postId: input.postId, reporterId, status: "OPEN" }, select: { id: true } });
  if (!existing) {
    await db.postReport.create({ data: { postId: input.postId, reporterId, reason: input.reason, details: input.details } });
    revalidatePath("/admin/reports");
  }
}
