import "server-only";
import { db } from "@/server/db";
import { checkAchievements } from "@/server/services/achievements";

/**
 * Saves or unsaves a job for a member (keeps the job's saveCount in step). Shared by the website's bookmark button
 * and the mobile API. Returns null when the job doesn't exist.
 */
export async function setSavedJob(userId: string, jobId: string, saved: boolean): Promise<{ saved: boolean } | null> {
  const existing = await db.savedJob.findUnique({ where: { userId_jobId: { userId, jobId } } });
  if (!saved) {
    if (existing) {
      await db.$transaction([
        db.savedJob.delete({ where: { userId_jobId: { userId, jobId } } }),
        db.job.update({ where: { id: jobId }, data: { saveCount: { decrement: 1 } } }),
      ]);
    }
    return { saved: false };
  }
  if (existing) return { saved: true };
  const job = await db.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return null;
  await db.$transaction([db.savedJob.create({ data: { userId, jobId } }), db.job.update({ where: { id: jobId }, data: { saveCount: { increment: 1 } } })]);
  await checkAchievements(userId, ["CAREER_EXPLORER"]);
  return { saved: true };
}
