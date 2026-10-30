import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ActionError } from "@/server/action";
import { refreshSitemap } from "@/server/sitemap";
import { notifyGoogleAboutJob } from "@/server/google-indexing";
import { jobData, notifyFollowersOfNewJob, type ParsedJob } from "@/server/services/job-posting";
import { startOfTodayUtc } from "@/lib/validation/job";

// Changing a job a company already posted, shared by the website's recruiter actions and the mobile API. Only jobs
// of the actor's own company; rule breaks throw ActionError with an encoded message key.

type Actor = { userId: string; companyId: string };

async function ownJob(actor: Actor, jobId: string) {
  const job = await db.job.findFirst({ where: { id: jobId, companyId: actor.companyId }, select: { id: true, title: true, status: true, publishedAt: true, closesAt: true, _count: { select: { applications: true } } } });
  if (!job) throw new ActionError("@msg.jobNotFound");
  return job;
}

function refresh(jobId: string) {
  revalidatePath("/recruiter");
  revalidatePath(`/jobs/${jobId}`);
  refreshSitemap();
  notifyGoogleAboutJob(jobId);
}

/** Saves the whole job form (skills and languages are replaced). Publishing a draft tells the company's followers. */
export async function updateJobForCompany(actor: Actor, jobId: string, data: ParsedJob) {
  const existing = await ownJob(actor, jobId);
  const { rest, skills, languages } = jobData(data);
  const validSkills = new Set((await db.skill.findMany({ where: { id: { in: skills.map((s) => s.skillId) } }, select: { id: true } })).map((s) => s.id));
  const publishNow = data.publish && existing.status === "DRAFT";
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
  if (publishNow && !existing.publishedAt) await notifyFollowersOfNewJob({ id: existing.id, title: data.title, companyId: actor.companyId }, actor.userId);
  refresh(existing.id);
  return "@msg.jobUpdated";
}

/** Open (live), paused or closed. Reopening checks the closing date; a first opening tells the followers. */
export async function setJobStatusForCompany(actor: Actor, jobId: string, status: "OPEN" | "PAUSED" | "CLOSED") {
  const job = await ownJob(actor, jobId);
  if (status === "OPEN" && job.closesAt && job.closesAt.getTime() < startOfTodayUtc()) throw new ActionError("@v.closesPast");
  await db.job.update({ where: { id: job.id }, data: { status, ...(status === "OPEN" && !job.publishedAt && { publishedAt: new Date() }) } });
  if (status === "OPEN" && !job.publishedAt) await notifyFollowersOfNewJob({ id: job.id, title: job.title, companyId: actor.companyId }, actor.userId);
  refresh(job.id);
  return status === "OPEN" ? "@msg.jobLive" : status === "PAUSED" ? "@msg.jobPaused" : "@msg.jobClosedMsg";
}

/** Deletes a job — or closes it instead when people applied, so their application history stays intact. */
export async function deleteJobForCompany(actor: Actor, jobId: string) {
  const job = await ownJob(actor, jobId);
  if (job._count.applications > 0) {
    await db.job.update({ where: { id: job.id }, data: { status: "CLOSED" } });
    refresh(job.id);
    return "@msg.jobClosedInstead";
  }
  await db.job.delete({ where: { id: job.id } });
  refresh(job.id);
  return "@msg.jobDeleted";
}
