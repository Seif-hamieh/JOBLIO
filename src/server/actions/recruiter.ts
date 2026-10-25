"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withRecruiter, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { refreshSitemap } from "@/server/sitemap";
import { getApplicationDetail, type ApplicationDetail } from "@/server/services/recruiter";
import { getManagedApplication, markViewed, transitionApplication } from "@/server/services/applications";
import { jobSchema, type JobInput } from "@/lib/validation/job";
import { createJobForCompany } from "@/server/services/job-posting";
import { deleteJobForCompany, setJobStatusForCompany, updateJobForCompany } from "@/server/services/job-editing";
import { setCandidateSaved } from "@/server/services/saved-candidates";
import { PIPELINE_STAGES } from "@/lib/constants";

const id = z.string().min(1).max(40);

export async function createJobAction(input: JobInput): Promise<ActionState<{ id: string }>> {
  return withRecruiter<{ id: string }>({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(jobSchema, input);
    if (!parsed.success) return parsed.state;
    const job = await createJobForCompany({ userId: viewer.id, companyId: viewer.company.id }, parsed.data);
    revalidatePath("/recruiter");
    refreshSitemap();
    return { ok: true, message: parsed.data.publish ? "@msg.jobPublished" : "@msg.draftSaved", data: { id: job.id } };
  });
}

// Editing, opening / pausing / closing and deleting jobs: the rules live in services/job-editing (shared with the app).

export async function updateJobAction(jobId: string, input: JobInput): Promise<ActionState<{ id: string }>> {
  return withRecruiter<{ id: string }>({ limit: LIMITS.write }, async (viewer) => {
    const jid = id.parse(jobId);
    const owned = await db.job.findFirst({ where: { id: jid, companyId: viewer.company.id }, select: { id: true } });
    if (!owned) return fail("@msg.jobNotFound");
    const parsed = parse(jobSchema, input);
    if (!parsed.success) return parsed.state;
    const message = await updateJobForCompany({ userId: viewer.id, companyId: viewer.company.id }, jid, parsed.data);
    return { ok: true, message, data: { id: jid } };
  });
}

export async function setJobStatusAction(jobId: string, status: "OPEN" | "PAUSED" | "CLOSED"): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => ({
    ok: true,
    message: await setJobStatusForCompany({ userId: viewer.id, companyId: viewer.company.id }, id.parse(jobId), z.enum(["OPEN", "PAUSED", "CLOSED"]).parse(status)),
  }));
}

/** Jobs with applicants are closed instead of deleted, so candidates' application history stays intact. */
export async function deleteJobAction(jobId: string): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => ({
    ok: true,
    message: await deleteJobForCompany({ userId: viewer.id, companyId: viewer.company.id }, id.parse(jobId)),
  }));
}

export async function moveApplicationAction(applicationId: string, stage: string, position: number, opts?: { leaveHired?: boolean }): Promise<ActionState> {
  return withRecruiter({ limit: { key: "pipeline", max: 120, windowMs: 60_000 } }, async (viewer) => {
    const s = z.enum(PIPELINE_STAGES).parse(stage);
    await transitionApplication({ id: viewer.id, companyId: viewer.company.id }, id.parse(applicationId), {
      stage: s,
      position: z.number().finite().parse(position),
      leaveHired: opts?.leaveHired === true,
    });
    return { ok: true };
  });
}

export async function setApplicationStatusAction(applicationId: string, status: "OFFER" | "REJECTED", note?: string): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const s = z.enum(["OFFER", "REJECTED"]).parse(status);
    const app = await getManagedApplication(viewer.company.id, id.parse(applicationId));
    await transitionApplication({ id: viewer.id, companyId: viewer.company.id }, app.id, {
      status: s,
      stage: s === "OFFER" ? "FINAL" : undefined,
      note: z.string().trim().max(500).optional().parse(note) || null,
    });
    revalidatePath(`/recruiter/jobs/${app.job.id}/pipeline`);
    return { ok: true, message: s === "OFFER" ? "@msg.offerRecorded" : "@msg.candidateDeclined" };
  });
}

export async function rateApplicationAction(applicationId: string, rating: number): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const app = await getManagedApplication(viewer.company.id, id.parse(applicationId));
    await db.application.update({ where: { id: app.id }, data: { rating: z.number().int().min(0).max(5).parse(rating) || null } });
    return { ok: true };
  });
}

export async function addNoteAction(applicationId: string, body: string): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const app = await getManagedApplication(viewer.company.id, id.parse(applicationId));
    const text = z.string().trim().min(1, "@v.writeNote").max(2000).safeParse(body);
    if (!text.success) return fail(text.error.issues[0]!.message);
    await db.recruiterNote.create({ data: { applicationId: app.id, authorId: viewer.id, body: text.data } });
    return { ok: true, message: "@msg.noteAdded" };
  });
}

export async function openApplicationAction(applicationId: string): Promise<ApplicationDetail | null> {
  const res = await withRecruiter<ApplicationDetail>({ limit: LIMITS.search }, async (viewer) => {
    await markViewed({ id: viewer.id, companyId: viewer.company.id }, id.parse(applicationId));
    const detail = await getApplicationDetail(applicationId, viewer.company.id);
    return detail ? { ok: true, data: detail } : fail("@msg.notFound");
  });
  return res?.ok ? (res.data ?? null) : null;
}

export async function toggleSaveCandidateAction(candidateId: string, note?: string): Promise<ActionState<{ saved: boolean }>> {
  return withRecruiter<{ saved: boolean }>({ limit: LIMITS.write }, async (viewer) => {
    const cid = id.parse(candidateId);
    const existing = await db.savedCandidate.findUnique({ where: { recruiterId_candidateId: { recruiterId: viewer.id, candidateId: cid } }, select: { id: true } });
    // The rules (the free limit of 10) live in services/saved-candidates (shared with the app).
    const message = await setCandidateSaved({ id: viewer.id, pro: viewer.recruiterPro }, cid, !existing, z.string().trim().max(500).optional().parse(note) || null);
    return { ok: true, data: { saved: !existing }, message };
  });
}
