"use server";

import { revalidatePath } from "next/cache";
import { fail, withViewer, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { resetResume, resumeSchema, saveResume, type ResumeFields } from "@/server/services/resume-builder";

/** Saves the CV builder form (the whole CV at once). */
export async function saveResumeAction(data: ResumeFields): Promise<ActionState<{ updatedAt: string }>> {
  return withViewer<{ updatedAt: string }>({ limit: LIMITS.write }, async (viewer) => {
    const parsed = resumeSchema.safeParse(data);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message.startsWith("@") ? parsed.error.issues[0].message : "@v.resumeInvalid");
    const updatedAt = await saveResume(viewer.id, parsed.data);
    revalidatePath("/resume-builder");
    return { ok: true, message: "@msg.resumeSaved", data: { updatedAt: updatedAt.toISOString() } };
  });
}

/** Starts the CV again from the profile. */
export async function resetResumeAction(): Promise<ActionState> {
  return withViewer({ limit: LIMITS.write }, async (viewer) => {
    await resetResume(viewer.id);
    revalidatePath("/resume-builder");
    return { ok: true };
  });
}
