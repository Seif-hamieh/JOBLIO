"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { applyToJob, withdrawApplication } from "@/server/services/applications";
import { checkAchievements } from "@/server/services/achievements";
import { storeUpload, UploadError } from "@/server/storage";

const idSchema = z.string().min(1).max(40);

export async function toggleSaveJob(jobId: string): Promise<ActionState<{ saved: boolean }>> {
  return withViewer<{ saved: boolean }>({ limit: LIMITS.write }, async (viewer) => {
    const id = idSchema.parse(jobId);
    const existing = await db.savedJob.findUnique({ where: { userId_jobId: { userId: viewer.id, jobId: id } } });
    if (existing) {
      await db.$transaction([
        db.savedJob.delete({ where: { userId_jobId: { userId: viewer.id, jobId: id } } }),
        db.job.update({ where: { id }, data: { saveCount: { decrement: 1 } } }),
      ]);
      revalidatePath("/jobs/saved");
      return { ok: true, data: { saved: false } };
    }
    const job = await db.job.findUnique({ where: { id }, select: { id: true } });
    if (!job) return fail("@msg.jobNotFound");
    await db.$transaction([db.savedJob.create({ data: { userId: viewer.id, jobId: id } }), db.job.update({ where: { id }, data: { saveCount: { increment: 1 } } })]);
    await checkAchievements(viewer.id, ["CAREER_EXPLORER"]);
    revalidatePath("/jobs/saved");
    return { ok: true, data: { saved: true } };
  });
}

const applySchema = z.object({
  jobId: idSchema,
  coverLetter: z
    .string()
    .trim()
    .max(4000, "@v.noteLength")
    .optional()
    .transform((v) => v || null),
});

export async function applyAction(_prev: ActionState<{ score: number }>, form: FormData): Promise<ActionState<{ score: number }>> {
  return withViewer({ limit: LIMITS.apply }, async (viewer) => {
    const parsed = parse(applySchema, { jobId: form.get("jobId"), coverLetter: form.get("coverLetter") ?? undefined });
    if (!parsed.success) return parsed.state;
    let resumeUrl: string | null = null;
    const file = form.get("resume");
    if (file instanceof File && file.size > 0) {
      try {
        resumeUrl = (await storeUpload(file, "resume", viewer.id)).url;
      } catch (e) {
        if (e instanceof UploadError) return fail(e.message);
        throw e;
      }
    }
    const { match } = await applyToJob(viewer.id, parsed.data.jobId, { coverLetter: parsed.data.coverLetter, resumeUrl });
    revalidatePath(`/jobs/${parsed.data.jobId}`);
    revalidatePath("/applications");
    return { ok: true, message: "@msg.applicationSent", data: { score: match.score } };
  });
}

export async function withdrawAction(applicationId: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await withdrawApplication(viewer.id, idSchema.parse(applicationId));
    revalidatePath("/applications");
    return { ok: true, message: "@msg.withdrawn" };
  });
}

const savedSearchSchema = z.object({
  kind: z.enum(["JOB", "CANDIDATE"]),
  name: z.string().trim().min(2, "@v.searchName").max(80),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
  alertsEnabled: z.boolean().default(false),
});

export async function saveSearchAction(input: z.input<typeof savedSearchSchema>): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(savedSearchSchema, input);
    if (!parsed.success) return parsed.state;
    if (parsed.data.kind === "CANDIDATE" && !viewer.company) return fail("@msg.onlyRecruitersSave");
    const count = await db.savedSearch.count({ where: { userId: viewer.id } });
    if (count >= 25) return fail("@msg.maxSearches");
    await db.savedSearch.create({ data: { userId: viewer.id, ...parsed.data, params: parsed.data.params } });
    revalidatePath("/jobs");
    return { ok: true, message: "@msg.searchSaved" };
  });
}

export async function deleteSavedSearchAction(id: string): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await db.savedSearch.deleteMany({ where: { id: idSchema.parse(id), userId: viewer.id } });
    revalidatePath("/jobs");
    revalidatePath("/jobs/saved");
    return { ok: true };
  });
}
