"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { fail, parse, withRecruiter, type ActionState } from "@/server/action";
import { LIMITS } from "@/server/rate-limit";
import { refreshSitemap } from "@/server/sitemap";
import { startOfTodayUtc } from "@/lib/validation/job";
import { publish } from "@/server/realtime";
import { getApplicationDetail, type ApplicationDetail } from "@/server/services/recruiter";
import { getManagedApplication, markViewed, transitionApplication } from "@/server/services/applications";
import { jobSchema, type JobInput } from "@/lib/validation/job";
import { PIPELINE_STAGES } from "@/lib/constants";
import { createT } from "@/i18n/translate";
import { k } from "@/i18n/message";

const id = z.string().min(1).max(40);

async function notifyFollowersOfNewJob(job: { id: string; title: string; companyId: string }, actorId: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: job.companyId }, select: { name: true } });
  const followers = await db.companyFollower.findMany({ where: { companyId: job.companyId }, select: { userId: true } });
  if (!followers.length) return;
  const settings = await db.userSettings.findMany({ where: { userId: { in: followers.map((f) => f.userId) }, notifyJobAlerts: false }, select: { userId: true } });
  const optedOut = new Set(settings.map((s) => s.userId));
  const recipients = followers.map((f) => f.userId).filter((u) => !optedOut.has(u) && u !== actorId);
  const vars = { company: company.name, companyId: job.companyId, job: job.title };
  const title = createT("en")("notif.newJob", vars);
  // Bulk insert keeps fan-out cheap even for large follower counts.
  await db.notification.createMany({ data: recipients.map((userId) => ({ userId, actorId, type: "NEW_JOB_FROM_FOLLOWED_COMPANY" as const, title, titleKey: "notif.newJob", vars, href: `/jobs/${job.id}` })) });
  // Encoded so each browser shows it in its own language.
  for (const u of recipients) publish(u, { type: "notification", id: job.id, title: k("notif.newJob", vars), href: `/jobs/${job.id}` });
}

function jobData(d: ReturnType<typeof jobSchema.parse>) {
  const { skills, languages, publish: _publish, ...rest } = d;
  void _publish;
  return { rest, skills, languages };
}

export async function createJobAction(input: JobInput): Promise<ActionState<{ id: string }>> {
  return withRecruiter<{ id: string }>({ limit: LIMITS.write }, async (viewer) => {
    const parsed = parse(jobSchema, input);
    if (!parsed.success) return parsed.state;
    const { rest, skills, languages } = jobData(parsed.data);
    const validSkills = new Set((await db.skill.findMany({ where: { id: { in: skills.map((s) => s.skillId) } }, select: { id: true } })).map((s) => s.id));
    const job = await db.job.create({
      data: {
        ...rest,
        companyId: viewer.company.id,
        postedById: viewer.id,
        status: parsed.data.publish ? "OPEN" : "DRAFT",
        publishedAt: parsed.data.publish ? new Date() : null,
        skills: { create: skills.filter((s, i, a) => validSkills.has(s.skillId) && a.findIndex((x) => x.skillId === s.skillId) === i) },
        languages: { create: languages.filter((l, i, a) => a.findIndex((x) => x.languageCode === l.languageCode) === i) },
      },
    });
    if (parsed.data.publish) await notifyFollowersOfNewJob(job, viewer.id);
    revalidatePath("/recruiter");
    refreshSitemap();
    return { ok: true, message: parsed.data.publish ? "@msg.jobPublished" : "@msg.draftSaved", data: { id: job.id } };
  });
}

export async function updateJobAction(jobId: string, input: JobInput): Promise<ActionState<{ id: string }>> {
  return withRecruiter<{ id: string }>({ limit: LIMITS.write }, async (viewer) => {
    const existing = await db.job.findFirst({ where: { id: id.parse(jobId), companyId: viewer.company.id }, select: { id: true, status: true, publishedAt: true } });
    if (!existing) return fail("@msg.jobNotFound");
    const parsed = parse(jobSchema, input);
    if (!parsed.success) return parsed.state;
    const { rest, skills, languages } = jobData(parsed.data);
    const validSkills = new Set((await db.skill.findMany({ where: { id: { in: skills.map((s) => s.skillId) } }, select: { id: true } })).map((s) => s.id));
    const publishNow = parsed.data.publish && existing.status === "DRAFT";
    await db.$transaction([
      db.jobSkill.deleteMany({ where: { jobId: existing.id } }),
      db.jobLanguage.deleteMany({ where: { jobId: existing.id } }),
      db.job.update({
        where: { id: existing.id },
        data: {
          ...rest,
          ...(publishNow && { status: "OPEN", publishedAt: existing.publishedAt ?? new Date() }),
          skills: { create: skills.filter((s, i, a) => validSkills.has(s.skillId) && a.findIndex((x) => x.skillId === s.skillId) === i) },
          languages: { create: languages.filter((l, i, a) => a.findIndex((x) => x.languageCode === l.languageCode) === i) },
        },
      }),
    ]);
    if (publishNow && !existing.publishedAt) await notifyFollowersOfNewJob({ id: existing.id, title: parsed.data.title, companyId: viewer.company.id }, viewer.id);
    revalidatePath("/recruiter");
    revalidatePath(`/jobs/${existing.id}`);
    refreshSitemap();
    return { ok: true, message: "@msg.jobUpdated", data: { id: existing.id } };
  });
}

export async function setJobStatusAction(jobId: string, status: "OPEN" | "PAUSED" | "CLOSED"): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const job = await db.job.findFirst({ where: { id: id.parse(jobId), companyId: viewer.company.id }, select: { id: true, title: true, publishedAt: true, closesAt: true } });
    if (!job) return fail("@msg.jobNotFound");
    const s = z.enum(["OPEN", "PAUSED", "CLOSED"]).parse(status);
    if (s === "OPEN" && job.closesAt && job.closesAt.getTime() < startOfTodayUtc()) return fail("@v.closesPast");
    await db.job.update({ where: { id: job.id }, data: { status: s, ...(s === "OPEN" && !job.publishedAt && { publishedAt: new Date() }) } });
    if (s === "OPEN" && !job.publishedAt) await notifyFollowersOfNewJob({ id: job.id, title: job.title, companyId: viewer.company.id }, viewer.id);
    revalidatePath("/recruiter");
    revalidatePath(`/jobs/${job.id}`);
    refreshSitemap();
    return { ok: true, message: s === "OPEN" ? "@msg.jobLive" : s === "PAUSED" ? "@msg.jobPaused" : "@msg.jobClosedMsg" };
  });
}

export async function deleteJobAction(jobId: string): Promise<ActionState> {
  return withRecruiter({ limit: LIMITS.write }, async (viewer) => {
    const job = await db.job.findFirst({ where: { id: id.parse(jobId), companyId: viewer.company.id }, select: { id: true, _count: { select: { applications: true } } } });
    if (!job) return fail("@msg.jobNotFound");
    // Keep candidates' application history intact: jobs with applicants are closed, not deleted.
    if (job._count.applications > 0) {
      await db.job.update({ where: { id: job.id }, data: { status: "CLOSED" } });
      revalidatePath("/recruiter");
      refreshSitemap();
      return { ok: true, message: "@msg.jobClosedInstead" };
    }
    await db.job.delete({ where: { id: job.id } });
    revalidatePath("/recruiter");
    refreshSitemap();
    return { ok: true, message: "@msg.jobDeleted" };
  });
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
    const key = { recruiterId_candidateId: { recruiterId: viewer.id, candidateId: cid } };
    const existing = await db.savedCandidate.findUnique({ where: key });
    if (existing) await db.savedCandidate.delete({ where: key });
    else {
      if (!viewer.recruiterPro && (await db.savedCandidate.count({ where: { recruiterId: viewer.id } })) >= 10) {
        return fail("@msg.savedLimit");
      }
      await db.savedCandidate.create({ data: { recruiterId: viewer.id, candidateId: cid, note: z.string().trim().max(500).optional().parse(note) || null } });
    }
    revalidatePath("/recruiter/saved");
    return { ok: true, data: { saved: !existing }, message: existing ? "@msg.candidateUnsaved" : "@msg.candidateSaved" };
  });
}
