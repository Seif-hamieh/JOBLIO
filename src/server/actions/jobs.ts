"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { applyToJob, withdrawApplication } from "@/server/services/applications";
import { setSavedJob } from "@/server/services/saved-jobs";
import { setJobAlertEnabled } from "@/server/services/job-alerts";
import { copyStored, deleteStored, storeUpload, UploadError } from "@/server/storage";

const idSchema = z.string().min(1).max(40);

export async function toggleSaveJob(jobId: string): Promise<ActionState<{ saved: boolean }>> {
  return withViewer<{ saved: boolean }>({ limit: LIMITS.write }, async (viewer) => {
    const id = idSchema.parse(jobId);
    const existing = await db.savedJob.findUnique({ where: { userId_jobId: { userId: viewer.id, jobId: id } }, select: { jobId: true } });
    const result = await setSavedJob(viewer.id, id, !existing);
    if (!result) return fail("@msg.jobNotFound");
    revalidatePath("/jobs/saved");
    return { ok: true, data: result };
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
    } else if (form.get("useSavedResume") === "1") {
      // The application gets its own copy, so it keeps the CV even if the profile CV changes later.
      const saved = (await db.profile.findUnique({ where: { userId: viewer.id }, select: { resumeUrl: true } }))?.resumeUrl;
      if (saved) resumeUrl = await copyStored(saved);
    }
    let match: Awaited<ReturnType<typeof applyToJob>>["match"];
    try {
      ({ match } = await applyToJob(viewer.id, parsed.data.jobId, { coverLetter: parsed.data.coverLetter, resumeUrl }));
    } catch (e) {
      await deleteStored([resumeUrl]);
      throw e;
    }
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

/** Turns a saved job search's alerts on or off (Job alerts in Settings, Saved jobs). */
export async function toggleJobAlertAction(id: string, enabled: boolean): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await setJobAlertEnabled(viewer.id, idSchema.parse(id), enabled);
    revalidatePath("/jobs/saved");
    revalidatePath("/settings");
    return { ok: true, message: enabled ? "@msg.alertOn" : "@msg.alertOff" };
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
